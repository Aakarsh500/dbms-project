export interface Assignment {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  status: 'pending' | 'submitted';
  resourceLink?: string | null;
  submissionUrl?: string | null;
  submissionName?: string | null;
  submittedAt?: string | null;
}

export interface StudentMessage {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  sender: 'admin';
}

export interface Student {
  name: string;
  regNo: string;
  attendedClasses: number;
  totalClasses: number;
  pendingAssignments: number;
  isBlocked: boolean;
  assignments: Assignment[];
  messages: StudentMessage[];
}

export interface Teacher {
  id: number;
  name: string;
  subject: string;
}

export type User = (Student & { role: 'student' }) | { role: 'admin' };

export enum Page {
  Home,
  StudentLogin,
  StudentDashboard,
  AdminLogin,
  AdminDashboard,
}
