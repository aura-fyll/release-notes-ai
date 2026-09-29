// src/llm.js — Generate release notes via OpenRouter
//
// Two prompt modes:
//   - Free tier: SHORT summary only, ~150 words, no categories.
//   - Pro tier:  FULL structured notes with categories, unlimited length.

const LANGUAGE_LABELS = {
  en: { features: '✨ Features', bugs: '🐛 Bug Fixes', docs: '📚 Documentation', refactor: '♻️ Refactor', perf: '⚡ Performance', other: '🔧 Other', summary: 'Summary' },
  es: { features: '✨ Funciones', bugs: '🐛 Correcciones', docs: '📚 Documentación', refactor: '♻️ Refactor', perf: '⚡ Rendimiento', other: '🔧 Otros', summary: 'Resumen' },
  fr: { features: '✨ Fonctionnalités', bugs: '🐛 Corrections', docs: '📚 Documentation', refactor: '♻️ Refactor', perf: '⚡ Performance', other: '🔧 Autres', summary: 'Résumé' },
  de: { features: '✨ Funktionen', bugs: '🐛 Fehlerbehebungen', docs: '📚 Dokumentation', refactor: '♻️ Refactor', perf: '⚡ Leistung', other: '🔧 Sonstiges', summary: 'Zusammenfassung' },
  ja: { features: '✨ 機能', bugs: '🐛 バグ修正', docs: '📚 ドキュメント', refactor: '♻️ リファクタ', perf: '⚡ パフォーマンス', other: '🔧 その他', summary: '概要' },
  zh: { features: '✨ 新功能', bugs: '🐛 Bug 修复', docs: '📚 文档', refactor: '♻️ 重构', perf: '⚡ 性能', other: '🔧 其他', summary: '概述' },
  hi: { features: '✨ विशेषताएँ', bugs: '🐛 बग सुधार', docs: '📚 दस्तावेज़', refactor: '♻️ रिफैक्टर', perf: '⚡ प्रदर्शन', other: '🔧 अन्य', summary: 'सारांश' },
};

async function generateReleaseNotes({ openrouterKey, model, owner, repo, tag, commits, prs, language, tone, isPro, maxWords }) {
  const labels = LANGUAGE_LABELS[language] || LANGUAGE_LABELS.en;

  const commitList = commits.slice(0, 300).map(c => `- ${c.message} [${c.author}]`).join('\n');
  const prList = prs.slice(0, 100).map(p => `- #${p.number} ${p.title}${p.labels.length ? ` (${p.labels.join(', ')})` : ''} [by ${p.user}]`).join('\n');

  // ─────────────────────────────────────────────────────────────
  // FREE TIER PROMPT — short, plain, no categories
  // ─────────────────────────────────────────────────────────────
  if (!isPro) {
    const freePrompt = `You are writing a brief release summary for ${owner}/${repo}, version ${tag}.

Output language: ${language}
Output: plain Markdown, no headers, no bullet points.

Here is the raw material:

## Pull Requests
${prList || '(none)'}

## Commits
${commitList || '(none)'}

Write ONE continuous paragraph (3–4 sentences, ~120–150 words) summarizing what this release changes for users. Plain prose. No headers, no bullets, no formatting. Just a paragraph.

Rules:
- Plain prose only. No Markdown headers. No bullet lists. No bold/italic.
- 3 to 4 sentences, max 150 words.
- Focus on user-visible changes. Ignore internal refactors.
- Do not invent features not present in the source material.
- Output ONLY the paragraph. No preamble, no closing.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': `https://github.com/${owner}/${repo}`,
        'X-Title': 'release-notes-ai',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: freePrompt }],
        temperature: 0.4,
        max_tokens: 350,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API ${response.status}: ${errText}`);
    }
    const data = await response.json();
    const notes = data.choices?.[0]?.message?.content?.trim();
    if (!notes) throw new Error('LLM returned empty response.');
    return notes;
  }

  // ─────────────────────────────────────────────────────────────
  // PRO TIER PROMPT — full structured notes with categories
  // ─────────────────────────────────────────────────────────────
  const proPrompt = `You are a senior engineer writing release notes for the open-source project ${owner}/${repo}, version ${tag}.

Tone: ${tone}
Output language: ${language}

Here is the raw material since the previous release:

## Pull Requests
${prList || '(none)'}

## Commits
${commitList || '(none)'}

Write polished, human-readable release notes in Markdown. Follow this EXACT structure:

# Release ${tag}

A one-paragraph executive ${labels.summary.toLowerCase()} (3–4 sentences) explaining what this release delivers and why it matters to users.

## ${labels.features}
- Bullet points of new features. Each starts with a user-facing verb (Add, Introduce, Enable…). Bold the key noun. 1 line each.

## ${labels.bugs}
- Bullet points of bug fixes. Reference the issue/PR number in parentheses when known.

## ${labels.docs}
- Bullet points of documentation improvements (omit section if none).

## ${labels.refactor}
- Bullet points of internal refactors that don't change behavior (omit if none).

## ${labels.perf}
- Bullet points of performance improvements (omit if none).

## ${labels.other}
- Anything else worth noting: breaking changes (flag with ⚠️), deprecations, dependency bumps.

**Rules:**
- Group items accurately based on PR labels, commit message prefix (feat:, fix:, docs:, refactor:, perf:), and content.
- Never invent features that aren't in the source material.
- If a section has no items, OMIT it entirely. Do not include empty sections.
- Use present tense, active voice.
- Each bullet ≤ 1 line.
- Do not include any "Generated with AI" disclaimer.
- Output ONLY the Markdown. No code fences around it.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openrouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': `https://github.com/${owner}/${repo}`,
      'X-Title': 'release-notes-ai',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: proPrompt }],
      temperature: 0.4,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter API ${response.status}: ${errText}`);
  }
  const data = await response.json();
  const notes = data.choices?.[0]?.message?.content?.trim();
  if (!notes) throw new Error('LLM returned empty response.');
  return notes;
}

module.exports = { generateReleaseNotes };
