const {envConfig} = require("../../env-config/env-config");
const transforms = require("./transforms");
const debug = require("debug")(envConfig.logNamespace("context-text"));

const contentText = require("../models/content-text");
const controller = require("./crud-controller").create(contentText, false);
debug.enabled = false;
exports.all = controller.all;
exports.findByConditions = controller.findByConditions;
exports.findById = controller.findById;

exports.create = (req, res) => {
  new contentText({
    name: req.body.name,
    text: req.body.text,
    category: req.body.category
  }).save()
    .then(createdContentText => {
      res.status(201).json({
        response: transforms.toObjectWithId(createdContentText)
      });
    })
    .catch(error => {
      res.status(500).json({
        message: "Create of contentText failed",
        error: error
      });
    });
};

exports.update = (req, res) => {
  const contentTextDoc = new contentText({
    _id: req.body.id,
    name: req.body.name,
    text: req.body.text,
    category: req.body.category
  });
  contentText.updateOne({_id: req.params.id}, contentTextDoc)
    .then(result => {
      if (result.n > 0) {
        res.status(200).json({
          response: req.body
        });
      } else {
        res.status(401).json({message: "Not authorised"});
      }
    })
    .catch(error => {
      res.status(500).json({
        message: "Update of contentTextDoc failed",
        input: contentTextDoc,
        error: error
      });
    });
};

exports.queryBy = function (type, value, res, req) {
  debug(`filtering - ${type}: ${value}`);
  const find = {};
  find[type] = value;
  contentText.find(find).sort("name")
    .then(documents => {
      res.status(200).json({
        request: {
          type: type,
          value: value
        },
        response: documents.map(transforms.toObjectWithId),
      });
    })
    .catch(error => {
      res.status(500).json({
        message: "Fetching contentText failed"
      });
    });
};

exports.findByName = (req, res) => {
  const type = "name";
  const value = req.params[type];
  debug(`find one - ${type}: ${value}`);
  const find = {};
  find[type] = value;
  contentText.findOne(find)
    .then(document => {
      res.status(200).json({
        request: {
          type: type,
          value: value
        },
        response: transforms.toObjectWithId(document),
      });
    })
    .catch(ignored => {
      res.status(200).json({
        request: {
          type: type,
          value: value
        },
        response: {},
      });
    });
};

exports.delete = (req, res) => {
  contentText.deleteOne({_id: req.params.id})
    .then(result => {
      console.log(result);
      if (result.n > 0) {
        res.status(200).json({message: "Deletion successful"});
      } else {
        res.status(401).json({message: "Not authorised"});
      }
    })
    .catch(error => {
      res.status(500).json({
        message: "Deletion of contentText failed",
        request: req.params.id,
        error: error
      });
    });
};
