export const MAX_MESSAGE_LENGTH = 2000;

export type Message = {
  id: string;
  authorName: string;
  subjectId: string;
  period: string;
  classNumber: string;
  text: string;
  createdAt: string;
};

export type MessageThread = {
  subjectId: string;
  period: string;
  classNumber: string;
};

export type NewMessage = MessageThread & { authorName: string; text: string };

export type Teacher = {
  id: string;
  name: string;
  updatedAt: string;
  subjects: {
    id: string;
    name: string;
    classes: { number: string; location: string }[];
  }[];
};
