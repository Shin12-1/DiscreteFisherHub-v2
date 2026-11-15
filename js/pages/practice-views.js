import { selectMixedQuestions } from '../core/quiz.mjs';
import { pageUrl } from '../core/router.js';
import { escapeHtml as escape } from '../core/html.mjs';



function getQuestions(bank) {
  if (!Array.isArray(bank?.quizzes)) {
    throw new TypeError('A Logic question bank is required.');
  }
  return bank.quizzes.flatMap((quiz) => Array.isArray(quiz?.questions) ? quiz.questions : []);
}

export function selectPracticeQuestions(bank, mode, random = Math.random) {
  if (mode === 'mixed-review') {
    const questions = getQuestions(bank);
    if (!questions.length) {
      throw new Error('Practice questions are not available yet.');
    }
    return selectMixedQuestions(questions, Math.min(5, questions.length), random);
  }
  const quiz = bank?.quizzes?.find((item) => item.id === mode);
  if (!Array.isArray(quiz?.questions) || !quiz.questions.length) {
    throw new Error('Questions for this practice set are not available.');
  }
  return [...quiz.questions];
}

export function selectAssessmentQuestions(bank, random = Math.random) {
  const questions = getQuestions(bank);
  if (questions.length < 5) {
    throw new Error('An assessment needs at least 5 available questions.');
  }
  return selectMixedQuestions(questions, questions.length, random);
}

export function practiceView(bank) {
  const quizzes = Array.isArray(bank?.quizzes) ? bank.quizzes : [];
  const cards = quizzes.filter((quiz) => Array.isArray(quiz.questions) && quiz.questions.length)
    .map((quiz) => `<article class="practice-card clay"><p class="tag">Lesson practice · ${quiz.questions.length} questions</p><h2>${escape(quiz.title)}</h2><p>Answer one question at a time and see a clear explanation after each response.</p><button class="button button-primary" type="button" data-start-practice="${escape(quiz.id)}">Practice this lesson</button></article>`).join('');
  const mixed = getQuestions(bank).length
    ? `<article class="practice-card practice-card-featured clay"><p class="tag">Mixed review</p><h2>Connect the ideas</h2><p>Try up to five questions selected across the Logic lessons.</p><button class="button button-primary" type="button" data-start-practice="mixed-review">Start mixed practice</button></article>`
    : '<p class="empty-state">Practice questions are not available yet.</p>';
  return `<div class="practice-page"><section class="learning-page-intro"><p class="tag">Low-stakes · learn as you go</p><h1>Practice one idea at a time.</h1><p>Choose a Logic lesson for immediate explanations, or mix topics to strengthen recall. Practice scores do not award XP or change lesson progress.</p></section><section class="practice-grid" aria-label="Practice options"><div class="practice-lesson-grid">${cards}</div>${mixed}</section></div>`;
}

export function flashcardsView(bank, index = 0, revealed = false) {
  const questions = getQuestions(bank);
  if (!questions.length) {
    return `<section class="empty clay"><h1>Flashcards are not available yet.</h1><p>Try a quiz while more question cards are being prepared.</p><a class="button button-primary" href="${pageUrl('quizzes')}">Try a quiz</a></section>`;
  }
  const cardIndex = Number.isInteger(index) ? ((index % questions.length) + questions.length) % questions.length : 0;
  const question = questions[cardIndex];
  const choices = question.choices.map((choice) => `<li>${escape(choice)}</li>`).join('');
  return `<div class="flashcard-focus"><section class="learning-page-intro"><p class="tag">Recall practice · no XP</p><h1>Flashcards for Logic.</h1><p>Try to recall the answer before revealing it. Use the explanation to review the idea, then move through the deck at your own pace.</p></section><section class="flashcard-panel clay" data-flashcard-id="${escape(question.id)}" aria-labelledby="flashcard-heading"><p class="quiz-progress-label" role="status" aria-live="polite">Card ${cardIndex + 1} of ${questions.length}</p><progress class="quiz-progress" value="${cardIndex + 1}" max="${questions.length}" aria-label="Flashcard progress"></progress><article class="flashcard-front"><h2 id="flashcard-heading" data-flashcard-heading tabindex="-1">Question</h2><p>${escape(question.prompt)}</p><ol class="flashcard-choices">${choices}</ol></article><div class="flashcard-answer" data-flashcard-answer ${revealed ? '' : 'hidden'} aria-live="polite"><h3>Answer</h3><p><strong>${escape(question.choices[question.answerIndex])}</strong></p><p>${escape(question.explanation)}</p></div><div class="flashcard-actions"><button class="button button-secondary" type="button" data-flashcard-previous ${cardIndex === 0 ? 'disabled' : ''}>Previous card</button><button class="button button-primary" type="button" data-flashcard-reveal>${revealed ? 'Hide answer' : 'Reveal answer'}</button><button class="button button-secondary" type="button" data-flashcard-next ${cardIndex === questions.length - 1 ? 'disabled' : ''}>Next card</button></div></section></div>`;
}

export function assessmentView(bank) {
  const count = Array.isArray(bank?.quizzes)
    ? bank.quizzes.reduce((total, quiz) => total + (Array.isArray(quiz.questions) ? quiz.questions.length : 0), 0)
    : 0;
  const ready = count >= 5;
  return `<div class="assessment-page">
    <section class="assessment-intro clay" aria-labelledby="assessment-overview-heading">
      <p class="tag">Formative checkpoint · no XP</p>
      <h1 id="assessment-overview-heading">Check what is sticking.</h1>
      <p>This untimed Logic checkpoint draws from questions currently available across published lessons. Answers and explanations stay hidden while you work; review them after you submit. This is practice feedback, not a course grade, and it does not affect lesson progress or XP.</p>
      <dl class="assessment-facts" aria-label="Checkpoint details">
        <div><dt>Question pool</dt><dd>${count} available questions</dd></div>
        <div><dt>Pace</dt><dd>Untimed</dd></div>
        <div><dt>Result</dt><dd>No XP</dd><small>Not a course grade</small></div>
      </dl>
      <section class="assessment-expectations" aria-labelledby="assessment-expectations-heading">
        <h2 id="assessment-expectations-heading">What to expect</h2>
        <ol><li>Answer one question at a time.</li><li>Move through the questions at your own pace.</li><li>Review your answers and explanations after you submit.</li></ol>
      </section>
      ${ready ? '<button class="button button-primary" type="button" data-start-assessment>Begin Logic checkpoint</button>' : '<p class="assessment-readiness" role="status">The checkpoint will be available when at least five questions are ready.</p>'}
    </section>
  </div>`;
}

export function practiceResultsView(session) {
  const { score, total, missedQuestions } = session.result;
  const review = missedQuestions.length
    ? `<section class="assessment-review" aria-labelledby="practice-review-heading"><h2 id="practice-review-heading">Review to learn</h2><ol>${missedQuestions.map((question) => {
      const selected = session.answers[session.questions.indexOf(question)];
      return `<li><h3>${escape(question.prompt)}</h3><p><strong>Your answer:</strong> ${selected === null || selected === undefined ? 'Not answered' : escape(question.choices[selected])}</p><p><strong>Correct answer:</strong> ${escape(question.choices[question.answerIndex])}</p><p>${escape(question.explanation)}</p></li>`;
    }).join('')}</ol></section>`
    : '<p class="assessment-perfect">Every answer was correct. Keep building on that understanding.</p>';
  return `<section class="assessment-results clay" aria-labelledby="practice-results-heading"><p class="tag">Practice complete · no XP</p><h1 id="practice-results-heading" tabindex="-1">A useful check-in.</h1><p class="assessment-score"><strong>${score} / ${total}</strong><span>${Math.round(score / total * 100)}%</span></p><p>This practice result does not change lesson progress or XP.</p>${review}<div class="quiz-actions"><button class="button button-primary" type="button" data-restart-learning>Try again</button><button class="button button-secondary" type="button" data-exit-learning>Back to practice</button></div></section>`;
}

export function assessmentResultsView(session) {
  const { score, total, missedQuestions } = session.result;
  const review = missedQuestions.length
    ? `<section class="assessment-review" aria-labelledby="assessment-review-heading"><h2 id="assessment-review-heading">Review your answers</h2><ol>${missedQuestions.map((question) => {
      const index = session.questions.indexOf(question);
      const selected = session.answers[index];
      return `<li><h3>${escape(question.prompt)}</h3><p><strong>Your answer:</strong> ${selected === null || selected === undefined ? 'Not answered' : escape(question.choices[selected])}</p><p><strong>Correct answer:</strong> ${escape(question.choices[question.answerIndex])}</p><p>${escape(question.explanation)}</p></li>`;
    }).join('')}</ol></section>`
    : '<p class="assessment-perfect">Every answer was correct. Nice work reviewing the Logic ideas.</p>';
  return `<section class="assessment-results clay" aria-labelledby="assessment-results-heading"><p class="tag">Checkpoint complete · no XP</p><h1 id="assessment-results-heading" tabindex="-1">Your practice result</h1><p class="assessment-score"><strong>${score} / ${total}</strong><span>${Math.round(score / total * 100)}%</span></p><p>This is feedback for your learning, not a grade. Your XP and lesson progress have not changed.</p>${review}<div class="quiz-actions"><button class="button button-primary" type="button" data-restart-assessment>Try checkpoint again</button><button class="button button-secondary" type="button" data-exit-assessment>Back to assessments</button></div></section>`;
}
