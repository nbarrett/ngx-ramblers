import express = require("express");
import { sendTransactionalMail } from "./transactional-mail/send-transactional-mail";
import { queryAccount } from "./account/account";
import { queryTemplates } from "./templates/query-templates";
import { listCreate } from "./lists/list-create";
import { lists } from "./lists/lists";
import { contactsCreate } from "./contacts/contacts-create";
import { attributes } from "./contacts/contact-attributes";
import { contacts } from "./contacts/contacts";
import { contactUpdate } from "./contacts/contact-update";
import { contactsInList } from "./contacts/contacts-in-list";
import { contactsRemoveFromList } from "./contacts/contacts-remove-from-list";
import { contactsAddToList } from "./contacts/contacts-add-to-list";
import { folders } from "./folders/folders";
import { listDelete } from "./lists/list-delete";
import { contactsBatchUpdate } from "./contacts/contacts-batch-update";
import { contactsDelete } from "./contacts/contact-delete";

const router = express.Router();

router.get("/folders", folders);
router.get("/contacts", contacts);
router.get("/contacts-in-list", contactsInList);
router.post("/contacts/delete", contactsDelete);
router.post("/contacts/create", contactsCreate);
router.post("/contacts/batch-update", contactsBatchUpdate);
router.post("/contacts/add-to-list", contactsAddToList);
router.post("/contacts/remove-from-list", contactsRemoveFromList);
router.get("/contacts/update", contactUpdate);
router.get("/contacts/attributes", attributes);
router.post("/transactional/send", sendTransactionalMail);
router.post("/templates", queryTemplates);
router.get("/lists", lists);
router.delete("/lists/delete", listDelete);
router.post("/lists/create", listCreate);
router.get("/account", queryAccount);

export const brevoRoutes = router;
