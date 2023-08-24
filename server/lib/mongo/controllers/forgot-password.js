const _ = require("lodash");
const member = require("../models/member");
const transforms = require("./transforms");
const authCommon = require("./auth-common");
const memberCommon = require("./member-common");
const {envConfig} = require("../../env-config/env-config");
const debug = require("debug")(envConfig.logNamespace("database:forgot-password"));

exports.forgotPassword = (req, res) => {
  try {
    if (req.body.credentialOne && req.body.credentialTwo) {
      const credentialOne = req.body.credentialOne.toLowerCase().trim();
      const credentialTwo = req.body.credentialTwo.toUpperCase().trim();
      const userDetails = req.body.userDetails;
      const criteria = {
        $and: [
          {$or: [{userName: {$eq: credentialOne}}, {email: {$eq: credentialOne}}]},
          {$or: [{membershipNumber: {$eq: credentialTwo}}, {postcode: {$eq: credentialTwo}}]}]
      };
      const fields = {
        groupMember: 1,
        firstName: 1,
        lastName: 1,
        membershipNumber: 1,
        email: 1,
        userName: 1,
        membershipExpiryDate: 1,
        passwordResetId: 1,
        mailchimpLists: 1
      };

      const loginResponse = {};
      const returnNotFound = () => {
        loginResponse.alertMessage = `No member was found with ${userDetails}. Please try again or`;
        res.status(401).json({loginResponse});
      };
      member.findOne(criteria, fields)
        .then(member => {
          debug("member", member);
          if (!member) {
            returnNotFound();
          } else if (!member.mailchimpLists.general.subscribed) {
            loginResponse.alertMessage = `Sorry, you are not setup in our system to receive emails so we can't send you the password reset instructions${authCommon.please}`;
            res.status(200).json({loginResponse});
          } else {
            loginResponse.alertMessage = "New password requested from login screen";
            memberCommon.resetUpdateStatusForMember(member);
            memberCommon.setPasswordResetId(member);
            member.save()
              .then(updatedMember => {
                const memberPayload = authCommon.toMemberPayload(updatedMember);
                loginResponse.member = transforms.toObjectWithId(member);
                authCommon.auditMemberLogin(memberPayload.userName, loginResponse, memberPayload);
                res.status(200).json({loginResponse});
              });
            loginResponse.alertMessage = userDetails + " search successful";
          }
        }).catch(error => {
        debug("err", error);
        if (!error) {
          returnNotFound();
        } else {
          authCommon.returnError({res, error});
        }
      });
    } else {
      res.status(400).json({message: "Message body must contain credentialOne and credentialTwo"});
    }
  } catch (error) {
    authCommon.returnError({res, error});
  }
};

exports.update = (req, res) => {
  const memberDocument = new member({
    _id: req.params.id,
    name: req.body.name,
    text: req.body.text,
    category: req.body.category
  });
  memberDocument.updateOne({_id: req.params.id}, memberDocument)
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
        message: "Update of member failed",
        input: memberDocument,
        error: error
      });
    });
};
