import { contentMetadata } from "../mongo/models/content-metadata";
import { ContentMetadata } from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import { RootFolder } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { ResolvedAlbumImage } from "../../../projects/ngx-ramblers/src/app/models/social-publish.model";

export async function resolveAlbumImages(baseUrl: string, albumName: string, imageNames?: string[]): Promise<ResolvedAlbumImage[]> {
  const album: ContentMetadata = await contentMetadata.findOne({name: albumName}).lean().exec();
  if (!album) {
    throw new Error(`No album found with name '${albumName}'`);
  }
  const rootFolder: RootFolder = album.rootFolder || RootFolder.carousels;
  const files = (album.files || []).filter(file => file.image);
  const selected = imageNames?.length
    ? imageNames.map(name => files.find(file => file.image === name)).filter(Boolean)
    : files;
  if (selected.length === 0) {
    throw new Error(`Album '${albumName}' has no images to publish`);
  }
  return selected.map(file => ({
    image: file.image,
    url: `${baseUrl}/api/aws/s3/${rootFolder}/${album.name}/${file.image}`
  }));
}
