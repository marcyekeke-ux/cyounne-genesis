import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

export interface CloudinaryResult {
  url: string;
  secure_url: string;
  public_id: string;
  resource_type: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;
}

interface Props {
  folder?: string;
  accept?: string;
  label?: string;
  onUploaded?: (r: CloudinaryResult) => void;
  className?: string;
}

export function MediaUploader({ folder = "cyounne", accept = "image/*,video/*", label = "Téléverser", onUploaded, className }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null);

  const pickAndUpload = async (file: File) => {
    // Aperçu immédiat (objectURL local)
    const localUrl = URL.createObjectURL(file);
    setPreview({ url: localUrl, type: file.type });
    setBusy(true);
    setProgress(0);
    try {
      const { data, error } = await supabase.functions.invoke("cyounne-cloudinary", {
        body: { folder },
      });
      if (error || !data?.signature) throw new Error(error?.message ?? "Signature Cloudinary indisponible");

      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", data.api_key);
      fd.append("timestamp", String(data.timestamp));
      fd.append("signature", data.signature);
      fd.append("folder", data.folder);
      if (data.public_id) fd.append("public_id", data.public_id);

      const xhr = new XMLHttpRequest();
      const result: CloudinaryResult = await new Promise((resolve, reject) => {
        xhr.open("POST", data.upload_url);
        xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
          else reject(new Error(`Cloudinary ${xhr.status}: ${xhr.responseText}`));
        };
        xhr.onerror = () => reject(new Error("Réseau Cloudinary"));
        xhr.send(fd);
      });

      setPreview({ url: result.secure_url, type: file.type });
      onUploaded?.(result);
      toast.success("Média uploadé");
    } catch (e: any) {
      toast.error(e?.message ?? "Échec upload");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <div className={className}>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && pickAndUpload(e.target.files[0])}
      />
      <div className="flex items-center gap-3">
        <Button type="button" disabled={busy} onClick={() => ref.current?.click()} className="bg-gradient-primary">
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
          {busy ? `${progress}%` : label}
        </Button>
        {preview && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setPreview(null)}>
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
      {preview && (
        <div className="mt-3 rounded-lg overflow-hidden bg-secondary/40 max-w-xs">
          {preview.type.startsWith("video/") ? (
            <video src={preview.url} controls className="w-full" />
          ) : (
            <img src={preview.url} alt="aperçu" className="w-full" />
          )}
        </div>
      )}
    </div>
  );
}
