import type { AnsweredQuestion } from "../../../shared/questions";

/** An answered ask_user call: each question, what the user chose or wrote, their note and images. */
export function QuestionAnswers({ answers }: { answers: AnsweredQuestion[] }) {
  return (
    <div className="space-y-2 border-l pl-3">
      {answers.map(({ question, choices, note, images }, i) => (
        <div key={i} className="space-y-0.5">
          <p className="text-xs text-muted-foreground">{question}</p>
          <p className="whitespace-pre-wrap text-foreground">
            {choices.length
              ? choices.join(", ")
              : images
                ? "Answered with images"
                : "Left to the agent"}
          </p>
          {note && (
            <p className="whitespace-pre-wrap text-muted-foreground">{note}</p>
          )}
          {!!images && (
            <p className="text-xs text-muted-foreground">
              {images} image{images > 1 && "s"}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
