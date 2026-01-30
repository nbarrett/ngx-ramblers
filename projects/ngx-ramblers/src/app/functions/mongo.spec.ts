import { parseMongoUri, extractGroupNameFromDatabase, extractClusterFromUri, extractUsernameFromUri, buildMongoUri } from "./mongo";

describe("MongoDB URI Functions", () => {

  describe("parseMongoUri", () => {
    it("should parse mongodb+srv URI with database and query params", () => {
      const result = parseMongoUri("mongodb+srv://FAKE_USER:FAKE_PASS@cluster0.fake.mongodb.net/fake-db?retryWrites=true&w=majority");

      expect(result).not.toBeNull();
      expect(result!.username).toBe("FAKE_USER");
      expect(result!.password).toBe("FAKE_PASS");
      expect(result!.database).toBe("fake-db");
      expect(result!.uri).toBe("mongodb+srv://cluster0.fake.mongodb.net/fake-db?retryWrites=true&w=majority");
    });

    it("should parse mongodb+srv URI without query params", () => {
      const result = parseMongoUri("mongodb+srv://FAKE_USER:FAKE_PASS@cluster.mongodb.net/fakedb");

      expect(result).not.toBeNull();
      expect(result!.username).toBe("FAKE_USER");
      expect(result!.password).toBe("FAKE_PASS");
      expect(result!.database).toBe("fakedb");
      expect(result!.uri).toBe("mongodb+srv://cluster.mongodb.net/fakedb");
    });

    it("should parse standard mongodb URI", () => {
      const result = parseMongoUri("mongodb://FAKE_USER:FAKE_PASS@localhost:27017/testdb");

      expect(result).not.toBeNull();
      expect(result!.username).toBe("FAKE_USER");
      expect(result!.password).toBe("FAKE_PASS");
      expect(result!.database).toBe("testdb");
      expect(result!.uri).toBe("mongodb://localhost:27017/testdb");
    });

    it("should handle URL-encoded special characters in username", () => {
      const result = parseMongoUri("mongodb+srv://FAKE%40USER:FAKE_PASS@cluster.net/db");

      expect(result).not.toBeNull();
      expect(result!.username).toBe("FAKE@USER");
      expect(result!.password).toBe("FAKE_PASS");
      expect(result!.database).toBe("db");
    });

    it("should handle URL-encoded special characters in password", () => {
      const result = parseMongoUri("mongodb+srv://FAKE_USER:FAKE%40PASS%21@cluster.net/db");

      expect(result).not.toBeNull();
      expect(result!.username).toBe("FAKE_USER");
      expect(result!.password).toBe("FAKE@PASS!");
      expect(result!.database).toBe("db");
    });

    it("should handle URI without database name", () => {
      const result = parseMongoUri("mongodb+srv://FAKE_USER:FAKE_PASS@cluster.net/");

      expect(result).not.toBeNull();
      expect(result!.username).toBe("FAKE_USER");
      expect(result!.password).toBe("FAKE_PASS");
      expect(result!.database).toBe("");
    });

    it("should handle complex passwords with special characters", () => {
      const result = parseMongoUri("mongodb+srv://FAKE_USER:FAKE%40PASS%21%23%24@cluster.net/fakedb");

      expect(result).not.toBeNull();
      expect(result!.username).toBe("FAKE_USER");
      expect(result!.password).toBe("FAKE@PASS!#$");
      expect(result!.database).toBe("fakedb");
    });

    it("should handle URI with multiple query parameters", () => {
      const result = parseMongoUri("mongodb+srv://FAKE_USER:FAKE_PASS@cluster.net/db?retryWrites=true&w=majority&maxPoolSize=10");

      expect(result).not.toBeNull();
      expect(result!.username).toBe("FAKE_USER");
      expect(result!.password).toBe("FAKE_PASS");
      expect(result!.database).toBe("db");
      expect(result!.uri).toBe("mongodb+srv://cluster.net/db?retryWrites=true&w=majority&maxPoolSize=10");
    });

    it("should handle URI with replica set", () => {
      const result = parseMongoUri("mongodb://FAKE_USER:FAKE_PASS@host1:27017,host2:27017,host3:27017/fakedb?replicaSet=rs0");

      expect(result).not.toBeNull();
      expect(result!.username).toBe("FAKE_USER");
      expect(result!.password).toBe("FAKE_PASS");
      expect(result!.database).toBe("fakedb");
      expect(result!.uri).toBe("mongodb://host1:27017,host2:27017,host3:27017/fakedb?replicaSet=rs0");
    });

    it("should return null if URI is empty", () => {
      const result = parseMongoUri("");
      expect(result).toBeNull();
    });

    it("should return null if URI is malformed", () => {
      const result = parseMongoUri("not-a-valid-uri");
      expect(result).toBeNull();
    });

    it("should return null if URI has no credentials", () => {
      const result = parseMongoUri("mongodb://localhost:27017/fakedb");
      expect(result).toBeNull();
    });

    it("should trim whitespace from URI", () => {
      const result = parseMongoUri("  mongodb+srv://FAKE_USER:FAKE_PASS@cluster.net/db  ");

      expect(result).not.toBeNull();
      expect(result!.username).toBe("FAKE_USER");
      expect(result!.password).toBe("FAKE_PASS");
    });

    it("should extract cluster from mongodb.net URI", () => {
      const result = parseMongoUri("mongodb+srv://FAKE_USER:FAKE_PASS@cluster0.fake.mongodb.net/db");

      expect(result).not.toBeNull();
      expect(result!.cluster).toBe("cluster0.fake");
    });

    it("should extract groupName from database name", () => {
      const result = parseMongoUri("mongodb+srv://FAKE_USER:FAKE_PASS@cluster.net/ngx-ramblers-bolton");

      expect(result).not.toBeNull();
      expect(result!.groupName).toBe("Bolton Group");
    });
  });

  describe("extractGroupNameFromDatabase", () => {
    it("should extract group name from ngx-ramblers prefixed database", () => {
      expect(extractGroupNameFromDatabase("ngx-ramblers-bolton")).toBe("Bolton Group");
    });

    it("should handle multi-word group names", () => {
      expect(extractGroupNameFromDatabase("ngx-ramblers-west-surrey")).toBe("West Surrey Group");
    });

    it("should handle database without prefix", () => {
      expect(extractGroupNameFromDatabase("bolton")).toBe("Bolton Group");
    });

    it("should return empty string for empty database", () => {
      expect(extractGroupNameFromDatabase("")).toBe("");
    });
  });

  describe("extractClusterFromUri", () => {
    it("should extract cluster from mongodb.net URI", () => {
      expect(extractClusterFromUri("mongodb+srv://FAKE_USER:FAKE_PASS@cluster0.fake.mongodb.net/db")).toBe("cluster0.fake");
    });

    it("should return null for non-mongodb.net URI", () => {
      expect(extractClusterFromUri("mongodb://localhost:27017/db")).toBeNull();
    });
  });

  describe("extractUsernameFromUri", () => {
    it("should extract username from mongodb+srv URI", () => {
      expect(extractUsernameFromUri("mongodb+srv://FAKE_USER:FAKE_PASS@cluster.net/db")).toBe("FAKE_USER");
    });

    it("should decode URL-encoded username", () => {
      expect(extractUsernameFromUri("mongodb+srv://FAKE%40USER:FAKE_PASS@cluster.net/db")).toBe("FAKE@USER");
    });

    it("should return null for URI without credentials", () => {
      expect(extractUsernameFromUri("mongodb://localhost:27017/db")).toBeNull();
    });
  });

  describe("buildMongoUri", () => {
    it("should build a valid mongodb+srv URI", () => {
      const uri = buildMongoUri({
        cluster: "cluster0.fake",
        username: "FAKE_USER",
        password: "FAKE_PASS",
        database: "fakedb"
      });

      expect(uri).toBe("mongodb+srv://FAKE_USER:FAKE_PASS@cluster0.fake.mongodb.net/fakedb?retryWrites=true&w=majority");
    });

    it("should URL-encode special characters in username and password", () => {
      const uri = buildMongoUri({
        cluster: "cluster0",
        username: "FAKE@USER",
        password: "FAKE@PASS!",
        database: "db"
      });

      expect(uri).toContain("FAKE%40USER");
      expect(uri).toContain("FAKE%40PASS!");
    });
  });
});
