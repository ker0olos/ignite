import type { AnsweredQuestion } from "../../../shared/questions";
import { readMessage } from "../../../shared/sentComments";
import { SentCommentCard } from "@/components/conversation/SentCommentCard";
import { SentFileCard } from "@/components/conversation/SentFileCard";
import { answerLabel } from "@/lib/questions";

/** An answered ask_user call: each question, what the user chose or wrote, their note, images, files and diff comments. */
export function QuestionAnswers({ answers }: { answers: AnsweredQuestion[] }) {
  return (
    <div className="space-y-2 border-l pl-3">
      {answers.map(({ question, choices, note, images }, i) => {
        const { text, files, comments } = readMessage(note ?? "");
        return (
          <div key={i} className="space-y-0.5">
            <p className="text-xs text-muted-foreground">{question}</p>
            <p className="whitespace-pre-wrap text-foreground">
              {answerLabel(choices, images, files.length)}
            </p>
            {text && (
              <p className="whitespace-pre-wrap text-muted-foreground">
                {text}
              </p>
            )}
            {!!images && (
              <p className="text-xs text-muted-foreground">
                {images} image{images > 1 && "s"}
              </p>
            )}
            {files.length + comments.length > 0 && (
              <div className="flex flex-col items-start gap-1.5 pt-1">
                {files.map((f, j) => (
                  <SentFileCard key={`f${j}`} file={f} />
                ))}
                {comments.map((c, j) => (
                  <SentCommentCard key={`c${j}`} comment={c} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
