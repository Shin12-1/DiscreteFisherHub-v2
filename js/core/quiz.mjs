function invalid(message) {
  throw new Error(`Invalid quiz bank: ${message}`);
}

export function validateQuizBank(bank, lessons) {
  if (!bank || bank.topicId !== 'logic' || !Array.isArray(bank.quizzes)) {
    invalid('expected a Logic quiz list.');
  }
  if (!Array.isArray(lessons) || lessons.length === 0) {
    invalid('Logic lessons are missing.');
  }

  const lessonIds = lessons.map((lesson) => lesson.id);
  if (lessonIds.some((id) => typeof id !== 'string' || !id) || new Set(lessonIds).size !== lessonIds.length) {
    invalid('lesson ids must be unique, non-empty strings.');
  }
  if (bank.quizzes.length !== lessonIds.length) {
    invalid('each Logic lesson must have exactly one quiz.');
  }

  const quizIds = new Set();
  const questionIds = new Set();
  for (const quiz of bank.quizzes) {
    if (!quiz || typeof quiz.id !== 'string' || !quiz.id || quizIds.has(quiz.id)) {
      invalid('quiz ids must be unique, non-empty strings.');
    }
    quizIds.add(quiz.id);
    if (quiz.id !== quiz.lessonId || !lessonIds.includes(quiz.lessonId) || typeof quiz.title !== 'string' || !quiz.title.trim()) {
      invalid(`quiz ${quiz.id} must match an existing lesson.`);
    }
    if (!Array.isArray(quiz.questions) || quiz.questions.length !== 5) {
      invalid(`quiz ${quiz.id} must contain exactly five questions.`);
    }

    for (const question of quiz.questions) {
      if (!question || typeof question.id !== 'string' || !question.id || questionIds.has(question.id)) {
        invalid('question ids must be unique, non-empty strings.');
      }
      questionIds.add(question.id);
      if (typeof question.prompt !== 'string' || !question.prompt.trim()) {
        invalid(`question ${question.id} needs a prompt.`);
      }
      if (!Array.isArray(question.choices) || question.choices.length !== 4 || question.choices.some((choice) => typeof choice !== 'string' || !choice.trim())) {
        invalid(`question ${question.id} must have four non-empty choices.`);
      }
      if (!Number.isInteger(question.answerIndex) || question.answerIndex < 0 || question.answerIndex >= question.choices.length) {
        invalid(`question ${question.id} has an invalid answer index.`);
      }
      if (typeof question.explanation !== 'string' || !question.explanation.trim()) {
        invalid(`question ${question.id} needs an explanation.`);
      }
    }
  }

  if (lessonIds.some((id) => !quizIds.has(id))) {
    invalid('every Logic lesson must have a matching quiz.');
  }
}

export function scoreQuiz(questions, answers) {
  if (!Array.isArray(questions)) {
    throw new TypeError('Quiz questions must be an array.');
  }
  const selections = Array.isArray(answers) ? answers : [];
  const missedQuestions = questions.filter((question, index) => selections[index] !== question.answerIndex);
  return {
    score: questions.length - missedQuestions.length,
    total: questions.length,
    missedQuestions
  };
}

export function selectMixedQuestions(questions, count = 5, random = Math.random) {
  if (!Array.isArray(questions)) {
    throw new TypeError('Quiz questions must be an array.');
  }
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError('Question count must be a non-negative integer.');
  }
  if (typeof random !== 'function') {
    throw new TypeError('Random source must be a function.');
  }

  const shuffled = [...questions];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError('Random source must return a value from 0 up to, but not including, 1.');
    }
    const swapIndex = Math.floor(value * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, count);
}
