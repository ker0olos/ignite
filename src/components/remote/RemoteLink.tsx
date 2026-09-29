import { CopyButton } from "@/components/remote/CopyButton";
import { RemoteQr } from "@/components/remote/RemoteQr";
import { Button } from "@/components/ui/button";

/** The link as a QR code to scan, with buttons to copy it or replace it. */
export function RemoteLink({
  url,
  onNewLink,
}: {
  url: string;
  /** Signs out every browser; they need the new link. */
  onNewLink: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col gap-2">
        <CopyButton text={url} />
        <Button
          size="sm"
          variant="outline"
          title="Signs out every browser; they need the new link."
          onClick={onNewLink}
        >
          New link
        </Button>
      </div>
      <RemoteQr url={url} />
    </div>
  );
}
