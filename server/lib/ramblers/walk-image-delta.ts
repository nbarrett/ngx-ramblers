import {
  imageIdentity,
  MAXIMUM_RAMBLERS_WALK_IMAGES,
  normalisedAlternativeText
} from "../../../projects/ngx-ramblers/src/app/functions/walk-images";
import { ExistingWalkImage, WalkImageDelta, WalkImageUpload } from "../models/walk-upload-metadata";

export { imageIdentity, MAXIMUM_RAMBLERS_WALK_IMAGES, normalisedAlternativeText };

export function calculateWalkImageDelta(existingImages: ExistingWalkImage[], desiredImages: WalkImageUpload[]): WalkImageDelta {
  const existing = existingImages || [];
  const desired = (desiredImages || []).slice(0, MAXIMUM_RAMBLERS_WALK_IMAGES);
  const desiredIdentities = desired.map(image => imageIdentity(image.fileName));
  const existingIdentities = existing.map(image => imageIdentity(image.fileName));
  const unidentifiableExistingImages = existingIdentities.some(identity => !identity);

  if (unidentifiableExistingImages) {
    return {
      fullReplace: true,
      removalIndexes: existing.map((image, index) => index),
      additions: desired,
      unchanged: 0,
      alternativeTextUpdates: desired.length,
      reorderRequired: false
    };
  }

  const keptIndexes = existingIdentities
    .map((identity, index) => ({identity, index}))
    .filter(item => desiredIdentities.includes(item.identity))
    .filter((item, position, items) => items.findIndex(other => other.identity === item.identity) === position)
    .map(item => item.index);

  const removalIndexes = existing
    .map((image, index) => index)
    .filter(index => !keptIndexes.includes(index));

  const additions = desired.filter(image => !keptIndexes.some(index => existingIdentities[index] === imageIdentity(image.fileName)));

  const resultingIdentities = keptIndexes
    .map(index => existingIdentities[index])
    .concat(additions.map(image => imageIdentity(image.fileName)));

  const reorderRequired = resultingIdentities.some((identity, index) => identity !== desiredIdentities[index]);

  return {
    fullReplace: false,
    removalIndexes,
    additions,
    unchanged: keptIndexes.length,
    alternativeTextUpdates: desired.filter(image => alternativeTextChanged(image, existing, existingIdentities)).length,
    reorderRequired
  };
}

function alternativeTextChanged(image: WalkImageUpload, existing: ExistingWalkImage[], existingIdentities: string[]): boolean {
  const matchIndex = existingIdentities.indexOf(imageIdentity(image.fileName));
  return matchIndex < 0 || normalisedAlternativeText(existing[matchIndex].alternativeText) !== normalisedAlternativeText(image.alternativeText);
}
