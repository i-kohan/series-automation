import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface CopyPromptCardProps {
  title?: string;
  description?: string;
  prompt: string;
}

export function CopyPromptCard({ title = 'Промпт для ChatGPT', description, prompt }: CopyPromptCardProps) {
  const [promptCopied, setPromptCopied] = useState(false);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(prompt);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
    toast.success('Промпт скопирован');
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">            
          <div className="p-4 border rounded-md bg-muted/30">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-md font-medium">{title}</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopyPrompt}
                className="h-8"
              >
                {promptCopied ? <CheckCircle2 className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {promptCopied ? 'Скопировано' : 'Копировать'}
              </Button>
            </div>
            {description && (
              <p className="text-sm text-muted-foreground mb-2">{description}</p>
            )}
            <div className="p-3 bg-background border rounded-md whitespace-pre-wrap text-sm font-mono">
              {prompt}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 