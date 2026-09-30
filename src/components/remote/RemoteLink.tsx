import { CopyButton } from "@/components/remote/CopyButton";
import { RemoteQr } from "@/components/remote/RemoteQr";

/** The link as a QR code to scan, with a button to copy it. */
export function RemoteLink({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-3">
      <CopyButton text={url} />
      <RemoteQr url={url} />
    </div>
  );
}
