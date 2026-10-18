/** A conversation's composer, which text can be added to. */
type TextTarget = { session: string | null; append: (text: string) => void };

let targets: TextTarget[] = [];
// Text for a conversation whose composer isn't showing yet; it takes it once it is.
const pending = new Map<string | null, string[]>();

function deliver(target: TextTarget) {
  const texts = pending.get(target.session);
  if (!texts) return;
  pending.delete(target.session);
  texts.forEach((t) => target.append(t));
}

/** Makes `target` the composer of its conversation, taking any text waiting for it, until the returned call. */
export function addTextTarget(target: TextTarget) {
  targets = [...targets, target];
  deliver(target);
  return () => {
    targets = targets.filter((t) => t !== target);
  };
}

/** Adds `text` to the conversation's composer draft, now if it shows, else once it does; true when added now. */
export function appendToComposer(session: string | null, text: string) {
  const target = targets.findLast((t) => t.session === session);
  if (target) {
    target.append(text);
    return true;
  }
  pending.set(session, [...(pending.get(session) ?? []), text]);
  return false;
}
