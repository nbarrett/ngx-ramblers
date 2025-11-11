describe("MongoDB URI Parser Logic", () => {
  interface MongoConfig {
    uri: string;
    db: string;
    username: string;
    password: string;
  }

  function parseMongoUri(mongoConfig: MongoConfig): void {
    if (!mongoConfig?.uri) {
      return;
    }

    const uri = mongoConfig.uri.trim();
    const uriPattern = /^mongodb(\+srv)?:\/\/([^:]+):([^@]+)@(.+)$/;
    const match = uri.match(uriPattern);

    if (match) {
      const [, srvSuffix, username, password, rest] = match;
      const protocol = `mongodb${srvSuffix || ""}`;

      mongoConfig.username = decodeURIComponent(username);
      mongoConfig.password = decodeURIComponent(password);
      mongoConfig.uri = `${protocol}://${rest}`;

      const dbMatch = rest.match(/^[^\/]+\/([^?]+)/);
      mongoConfig.db = dbMatch ? dbMatch[1] : "";
    }
  }

  describe("parseMongoUri", () => {
    it("should parse mongodb+srv URI with database and query params", () => {
      const config: MongoConfig = {
        uri: "mongodb+srv://example-user:example-pass@cluster0.example.mongodb.net/example-db?retryWrites=true&w=majority",
        db: "",
        username: "",
        password: ""
      };

      parseMongoUri(config);

      expect(config.username).toBe("example-user");
      expect(config.password).toBe("example-pass");
      expect(config.db).toBe("example-db");
      expect(config.uri).toBe("mongodb+srv://cluster0.example.mongodb.net/example-db?retryWrites=true&w=majority");
    });

    it("should parse mongodb+srv URI without query params", () => {
      const config: MongoConfig = {
        uri: "mongodb+srv://user:pass@cluster.mongodb.net/mydb",
        db: "",
        username: "",
        password: ""
      };

      parseMongoUri(config);

      expect(config.username).toBe("user");
      expect(config.password).toBe("pass");
      expect(config.db).toBe("mydb");
      expect(config.uri).toBe("mongodb+srv://cluster.mongodb.net/mydb");
    });

    it("should parse standard mongodb URI", () => {
      const config: MongoConfig = {
        uri: "mongodb://admin:secret@localhost:27017/testdb",
        db: "",
        username: "",
        password: ""
      };

      parseMongoUri(config);

      expect(config.username).toBe("admin");
      expect(config.password).toBe("secret");
      expect(config.db).toBe("testdb");
      expect(config.uri).toBe("mongodb://localhost:27017/testdb");
    });

    it("should handle URL-encoded special characters in username", () => {
      const config: MongoConfig = {
        uri: "mongodb+srv://user%40example:pass@cluster.net/db",
        db: "",
        username: "",
        password: ""
      };

      parseMongoUri(config);

      expect(config.username).toBe("user@example");
      expect(config.password).toBe("pass");
      expect(config.db).toBe("db");
    });

    it("should handle URL-encoded special characters in password", () => {
      const config: MongoConfig = {
        uri: "mongodb+srv://user:p%40ss%21@cluster.net/db",
        db: "",
        username: "",
        password: ""
      };

      parseMongoUri(config);

      expect(config.username).toBe("user");
      expect(config.password).toBe("p@ss!");
      expect(config.db).toBe("db");
    });

    it("should override existing database from URI if provided", () => {
      const config: MongoConfig = {
        uri: "mongodb+srv://user:pass@cluster.net/new-db",
        db: "existing-db",
        username: "",
        password: ""
      };

      parseMongoUri(config);

      expect(config.db).toBe("new-db");
    });

    it("should handle URI without database name", () => {
      const config: MongoConfig = {
        uri: "mongodb+srv://user:pass@cluster.net/",
        db: "",
        username: "",
        password: ""
      };

      parseMongoUri(config);

      expect(config.username).toBe("user");
      expect(config.password).toBe("pass");
      expect(config.db).toBe("");
    });

    it("should clear existing database when URI has no database", () => {
      const config: MongoConfig = {
        uri: "mongodb+srv://user:pass@cluster.net/",
        db: "existing-db",
        username: "",
        password: ""
      };

      parseMongoUri(config);

      expect(config.db).toBe("");
    });

    it("should handle complex passwords with special characters", () => {
      const config: MongoConfig = {
        uri: "mongodb+srv://myuser:P%40ssw0rd%21%23%24@cluster.net/mydb",
        db: "",
        username: "",
        password: ""
      };

      parseMongoUri(config);

      expect(config.username).toBe("myuser");
      expect(config.password).toBe("P@ssw0rd!#$");
      expect(config.db).toBe("mydb");
    });

    it("should handle URI with multiple query parameters", () => {
      const config: MongoConfig = {
        uri: "mongodb+srv://user:pass@cluster.net/db?retryWrites=true&w=majority&maxPoolSize=10",
        db: "",
        username: "",
        password: ""
      };

      parseMongoUri(config);

      expect(config.username).toBe("user");
      expect(config.password).toBe("pass");
      expect(config.db).toBe("db");
      expect(config.uri).toBe("mongodb+srv://cluster.net/db?retryWrites=true&w=majority&maxPoolSize=10");
    });

    it("should handle URI with replica set", () => {
      const config: MongoConfig = {
        uri: "mongodb://user:pass@host1:27017,host2:27017,host3:27017/mydb?replicaSet=rs0",
        db: "",
        username: "",
        password: ""
      };

      parseMongoUri(config);

      expect(config.username).toBe("user");
      expect(config.password).toBe("pass");
      expect(config.db).toBe("mydb");
      expect(config.uri).toBe("mongodb://host1:27017,host2:27017,host3:27017/mydb?replicaSet=rs0");
    });

    it("should do nothing if URI is empty", () => {
      const config: MongoConfig = {
        uri: "",
        db: "",
        username: "original",
        password: ""
      };

      parseMongoUri(config);

      expect(config.username).toBe("original");
    });

    it("should do nothing if URI is malformed", () => {
      const config: MongoConfig = {
        uri: "not-a-valid-uri",
        db: "",
        username: "original",
        password: ""
      };

      parseMongoUri(config);

      expect(config.username).toBe("original");
    });

    it("should handle URI without credentials", () => {
      const config: MongoConfig = {
        uri: "mongodb://localhost:27017/mydb",
        db: "",
        username: "original",
        password: ""
      };

      parseMongoUri(config);

      expect(config.username).toBe("original");
    });

    it("should trim whitespace from URI", () => {
      const config: MongoConfig = {
        uri: "  mongodb+srv://user:pass@cluster.net/db  ",
        db: "",
        username: "",
        password: ""
      };

      parseMongoUri(config);

      expect(config.username).toBe("user");
      expect(config.password).toBe("pass");
    });
  });
});
