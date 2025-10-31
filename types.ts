
export interface Student {
  name: string;
  regNo: string;
  attendance: number;
  pendingAssignments: number;
  isBlocked: boolean;
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
