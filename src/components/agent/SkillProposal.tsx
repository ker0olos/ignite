import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProposedSkill } from "../../../shared/lessons";

/** A section the reflector would add to a skill (or a new skill): the skill, the text, why, and Keep or Discard. */
export function SkillProposal({
  proposal,
  onAnswer,
}: {
  proposal: ProposedSkill;
  onAnswer: (keep: boolean) => void;
}) {
  return (
    <li className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1">
          <Sparkles className="size-3.5 shrink-0 text-muted-foreground" />
          {proposal.description ? "New skill" : "Add to skill"}
          <code className="font-mono text-xs">{proposal.skill}</code>
        </p>
        {proposal.description && (
          <p className="text-xs text-muted-foreground">
            {proposal.description}
          </p>
        )}
        <pre className="mt-1 max-h-40 overflow-auto rounded-md border bg-muted/50 p-2 font-mono text-xs whitespace-pre-wrap">
          {proposal.add}
        </pre>
        {proposal.evidence && (
          <p className="mt-1 text-xs text-muted-foreground italic">
            {proposal.evidence}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button size="sm" onClick={() => onAnswer(true)}>
          Keep
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAnswer(false)}>
          Discard
        </Button>
      </div>
    </li>
  );
}
