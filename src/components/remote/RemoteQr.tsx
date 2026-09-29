import { renderSVG } from "uqr";

/** A QR code for `url`, to scan with a phone's camera. */
export function RemoteQr({ url }: { url: string }) {
  return (
    <div
      role="img"
      aria-label="QR code for the link"
      className="size-24 overflow-hidden rounded-md"
      dangerouslySetInnerHTML={{ __html: renderSVG(url) }}
    />
  );
}
