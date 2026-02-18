/**
 * Interaction Tools - 사용자 상호작용 도구
 */

export {
  // Main function
  askUser,
  askUserQuick,
  // Question builders
  createQuestionFromTemplate,
  createRequiredQuestionSet,
  generateQuestionId,
  // Formatting
  formatQuestionAsMarkdown,
  formatQuestionsForUser,
  // Parsing
  parseUserResponse,
  // Templates
  QUESTION_TEMPLATES,
} from './askUser.js';

export type {
  Question,
  QuestionCategory,
  QuestionOption,
  QuestionResponse,
  QuestionType,
  AskUserInput,
  AskUserOutput,
  AskUserParams,
} from './askUser.js';
