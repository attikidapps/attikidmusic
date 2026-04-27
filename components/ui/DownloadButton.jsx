'use client';
import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getSessionId } from '@/lib/utils'; // adjust to wherever yours lives

export default function DownloadButton({ song }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  if (!song?.id || song.downloadable === false) return null;

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch(`/api/downloads/${song.id}`, {
        headers: { 'x-session-id': getSessionId() },
      });
      if (res.status === 429) throw new Error('Too many downloads. Try again in a minute.');
      if (!res.ok) throw new Error('Download failed.');
      const { url, filename } = await res.json();

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      toast({ title: 'Download error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleDownload}
      disabled={loading}
      aria-label={`Download ${song.title}`}
      title={`Download ${song.title}`}
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
    </Button>
  );
}
