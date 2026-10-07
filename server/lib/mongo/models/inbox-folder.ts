import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import uniqueValidator from "mongoose-unique-validator";
import { InboxUserFolder } from "../../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { INBOX_FOLDERS_COLLECTION } from "../migrations/shared/collection-names";

const inboxFolderSchema = new mongoose.Schema({
  tenantSlug: {type: String, required: true, index: true},
  name: {type: String, required: true},
  slug: {type: String, default: "", index: true},
  sortIndex: {type: Number, required: true, index: true},
  createdByMemberId: {type: String, default: null}
}, {collection: INBOX_FOLDERS_COLLECTION});

inboxFolderSchema.plugin(uniqueValidator);

export const inboxFolder: mongoose.Model<InboxUserFolder> = ensureModel<InboxUserFolder>("inbox-folder", inboxFolderSchema);
