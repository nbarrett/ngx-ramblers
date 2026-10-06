import { isString } from "es-toolkit/compat";
import { FileNameData } from "../models/aws-object.model";
import { CommitteeFile, CommitteeFileKind } from "../models/committee.model";

export function composedCommitteeFileContentPresent(file: CommitteeFile): boolean {
  return !!(file?.document?.title || file?.document?.markdown);
}

export function committeeFileForSave(kind: CommitteeFileKind, file: CommitteeFile, attachmentTitle: string | null): CommitteeFile {
  if (kind === CommitteeFileKind.COMPOSED && composedCommitteeFileContentPresent(file)) {
    return {...file, fileNameData: null};
  } else if (kind === CommitteeFileKind.ATTACHMENT) {
    const fileNameData = attachmentFileNameData(file, attachmentTitle);
    const document = fileNameData?.awsFileName || !composedCommitteeFileContentPresent(file) ? null : file.document;
    return {...file, fileNameData, document};
  } else {
    return {...file, document: composedCommitteeFileContentPresent(file) ? file.document : null};
  }
}

function attachmentFileNameData(file: CommitteeFile, attachmentTitle: string | null): FileNameData | null {
  const title = isString(attachmentTitle) ? attachmentTitle : (file.fileNameData?.title || "");
  if (file.fileNameData) {
    return {...file.fileNameData, title};
  } else if (title) {
    return {title};
  } else {
    return null;
  }
}
