import { MarkedOptions, MarkedRenderer } from "ngx-markdown";
import { awsImageResourcePath, resourceAwsImageUrls } from "../../functions/aws-image-paths";
import { nativeApiUrl } from "../../functions/native-walking";

export function markdownOptions(): MarkedOptions {
  const renderer = new MarkedRenderer();
  const renderImage = renderer.image;
  const renderHtml = renderer.html;
  const imagePath = (path: string) => nativeApiUrl(awsImageResourcePath(path));
  renderer.image = function(token) {
    return renderImage.call(this, {...token, href: imagePath(token.href)});
  };
  renderer.html = function(token) {
    return renderHtml.call(this, {...token, text: resourceAwsImageUrls(token.text, imagePath)});
  };
  return {renderer};
}
