import { localExamItems } from '../data/examItems';
import { ExamItem } from '../types';

export function fetchExamItems(): ExamItem[] {
  return localExamItems;
}
