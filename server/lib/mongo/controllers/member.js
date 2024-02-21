const _ = require("lodash")
const {envConfig} = require("../../env-config/env-config");
const authConfig = require("../../auth/auth-config");
const debug = require("debug")(envConfig.logNamespace("database:member"));
const member = require("../models/member");
const transforms = require("./transforms");
const querystring = require("querystring");
const crudController = require("./crud-controller").create(member);

exports.update = crudController.update
exports.all = crudController.all
exports.deleteOne = crudController.deleteOne
exports.findById = crudController.findById

exports.update = (req, res) => {
  const password = req.body.password;
  if (password && password.length < 60) {
    authConfig.hashValue(req.body.password).then(hash => {
      debug("non-encrypted password found:", password, "- encrypted to:", hash)
      req.body.password = hash;
      crudController.update(req, res)
    })
  } else {
    crudController.update(req, res)
  }
}

exports.updateEmailSubscription = (req, res) => {
  const {criteria, document} = transforms.criteriaAndDocument(req);
  debug("updateEmailSubscription:", req.body, "conditions:", criteria, "request document:", document);
  member.findOneAndUpdate(criteria, document, {new: true})
    .then(result => {
      debug("update result:", result, "request document:", document);
      res.status(200).json({
        body: req.body,
        document,
        action: "update",
        response: result
      });
    })
    .catch(error => {
      res.status(500).json({
        message: "Update of member failed",
        request: document,
        error: transforms.parseError(error)
      });
    });
};


function findByConditions(conditions, fields, res, req) {
  debug("findByConditions - conditions:", conditions, "fields:", fields)
  member.findOne(conditions, fields)
    .then(member => {
      if (member) {
        res.status(200).json({
          action: "query",
          response: fields ? member : transforms.toObjectWithId(member)
        });
      } else {
        res.status(404).json({
          error: "member not found",
          request: conditions
        });
      }
    })
    .catch(error => {
      res.status(500).json({
        message: "member query failed",
        request: req.params.id,
        error: transforms.parseError(error)
      });
    });
}

exports.findByPasswordResetId = (req, res) => {
  debug("find - password-reset-id:", req.params.id)
  const conditions = {passwordResetId: req.params.id};
  findByConditions(conditions, "userName", res, req);
};

exports.findOne = (req, res) => {
  const conditions = querystring.parse(req.query);
  debug("find - by conditions", req.query, "conditions:", conditions)
  findByConditions(req.query, undefined, res, req);
};

exports.create = (req, res, next) => {
  const document = transforms.createDocumentRequest(req);
  const returnError = (error, context) => {
    res.status(500).json({
      message: "Unexpected error " + context,
      error: transforms.parseError(error),
      request: req.body,
    });
  };
  const createMember = (memberObject) => new member(memberObject).save()
    .then(result => {
      res.status(201).json({action: "create", response: transforms.toObjectWithId(result)});
    }).catch(error => returnError(error, "saving member"));

  if (req.body.password) {
    authConfig.hashValue(req.body.password)
      .then(password => {
        const documentWithPasswordEncrypted = _.extend({}, document, {password});
        createMember(documentWithPasswordEncrypted);
      }).catch(error => returnError(error, "encrypting password for member"));
  } else {
    createMember(document)
  }
}
