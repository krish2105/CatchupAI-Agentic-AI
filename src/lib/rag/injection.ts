/**
 * Heuristic detector for text aimed at an AI assistant inside course material (prompt injection). It can't
 * catch everything, so it is one layer among several: passages stay untrusted data, tools re-check ownership,
 * and nothing is saved without the student's approval. A flagged passage is shown to the model with a warning
 * and can never back a "fact" in an answer.
 */
const PATTERNS: RegExp[] = [
  /\b(ignore|disregard|forget|override)\b[^.]{0,40}\b(previous|prior|above|earlier|all|your)\b[^.]{0,20}\b(instructions?|rules|prompts?|guidelines)\b/i,
  /\byou are (now )?(in |operating in )?(admin|developer|god|jailbreak|dan)\b[^.]{0,10}\bmode\b/i,
  /\b(developer|admin|debug) mode\b/i,
  /^\s*(system|assistant|developer)\s*:/im,
  /\b(reveal|print|show|disclose|leak)\b[^.]{0,30}\b(system prompt|prompt|instructions|private data|other students?)\b/i,
  /\b(approve|delete|drop|erase)\b[^.]{0,30}\b(all|every)\b[^.]{0,30}\b(plans?|proposals?|assignments?|data|records)\b/i,
  /\b(call|invoke|run|use) (the )?(tool )?(draft_recovery_plan|search_course_material|list_assignments|get_\w+|suggest_memory)\b/i,
  /\bnote to (ai|the ai|assistants?|language models?|chatbots?)\b/i,
  /\b(always|must) cite\b/i,
  /\b(decode|base64)\b[^.]{0,30}\b(follow|execute|obey)\b|\b(follow|execute|obey)\b[^.]{0,30}\b(decode|base64)\b/i,
  /[A-Za-z0-9+/]{40,}={0,2}/,
  // Spanish / French / German / Portuguese variants of "ignore the rules" / "instructions for the assistant".
  /\b(ignora|ignorez|ignoriere|ignore)\b[^.]{0,30}\b(reglas|instrucciones|règles|regles|consignes|anweisungen|regeln|regras|instruções)\b/i,
  /\b(instrucciones para el asistente|consignes pour l'assistant|anweisungen für den assistenten|instruções para o assistente)\b/i,
];

export function looksLikeInjection(text: string): boolean {
  return PATTERNS.some((p) => p.test(text));
}
