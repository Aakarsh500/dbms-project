import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Assignment, Page, Student, StudentMessage, Teacher, User } from './types';
import Header from './components/Header';
import Card from './components/Card';
import Button from './components/Button';
import Input from './components/Input';
import Modal from './components/Modal';
import { UserIcon, ShieldCheckIcon, EyeIcon, LockClosedIcon, LockOpenIcon, TrashIcon } from './components/icons';
import { db, storage } from './firebase';
import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

// --- MOCK DATA ---
const MOCK_TEACHERS: Teacher[] = [
  { id: 1, name: 'Dr. Evelyn Reed', subject: 'Quantum Physics' },
  { id: 2, name: 'Mr. Samuel Drake', subject: 'Ancient History' },
  { id: 3, name: 'Ms. Clara Oswald', subject: 'Computer Science' },
  { id: 4, name: 'Prof. Alistair Finch', subject: 'Literature' },
];

const TOTAL_CLASSES = 10;

type RawStudentDoc = Partial<Student> & { attendance?: number };

const makeAssignmentId = () => {
  try {
    if (typeof globalThis !== 'undefined' && 'crypto' in globalThis) {
      const cryptoObj = globalThis.crypto as Crypto;
      if (typeof cryptoObj.randomUUID === 'function') {
        return cryptoObj.randomUUID();
      }
    }
  } catch (error) {
    console.warn('Falling back to generated assignment id', error);
  }

  return `assignment-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const makeMessageId = () => {
  try {
    if (typeof globalThis !== 'undefined' && 'crypto' in globalThis) {
      const cryptoObj = globalThis.crypto as Crypto;
      if (typeof cryptoObj.randomUUID === 'function') {
        return cryptoObj.randomUUID();
      }
    }
  } catch (error) {
    console.warn('Falling back to generated message id', error);
  }

  return `message-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeAssignment = (assignment: Partial<Assignment>): Assignment => {
  const normalizedId = typeof assignment.id === 'string' && assignment.id.trim()
    ? assignment.id.trim()
    : makeAssignmentId();

  const dueDate = typeof assignment.dueDate === 'string' && assignment.dueDate
    ? new Date(assignment.dueDate).toISOString()
    : new Date().toISOString();

  const status = assignment.status === 'submitted' ? 'submitted' : 'pending';

  return {
    id: normalizedId,
    title: typeof assignment.title === 'string' ? assignment.title : 'Untitled assignment',
    description: typeof assignment.description === 'string' ? assignment.description : 'No description provided.',
    dueDate,
    status,
    resourceLink: typeof assignment.resourceLink === 'string' ? assignment.resourceLink : null,
    submissionUrl: typeof assignment.submissionUrl === 'string' ? assignment.submissionUrl : null,
    submissionName: typeof assignment.submissionName === 'string' ? assignment.submissionName : null,
    submittedAt: typeof assignment.submittedAt === 'string' ? assignment.submittedAt : null,
  };
};

const normalizeMessage = (message: Partial<StudentMessage>): StudentMessage => {
  const normalizedId = typeof message.id === 'string' && message.id.trim()
    ? message.id.trim()
    : makeMessageId();

  const createdAt = typeof message.createdAt === 'string' && message.createdAt
    ? new Date(message.createdAt).toISOString()
    : new Date().toISOString();

  return {
    id: normalizedId,
    title: typeof message.title === 'string' && message.title.trim() ? message.title.trim() : 'Message from admin',
    body: typeof message.body === 'string' && message.body.trim() ? message.body.trim() : 'No message content provided.',
    createdAt,
    sender: 'admin',
  };
};

const getPendingAssignmentsCount = (assignments: Assignment[], fallback: number): number => {
  if (!assignments.length) {
    return fallback;
  }
  return assignments.filter(assignment => assignment.status !== 'submitted').length;
};

const normalizeStudentData = (data: RawStudentDoc, fallbackRegNo: string): Student => {
  const totalClasses = typeof data.totalClasses === 'number' && data.totalClasses > 0 ? data.totalClasses : TOTAL_CLASSES;

  const attendedFromNewField = typeof data.attendedClasses === 'number' ? data.attendedClasses : undefined;
  const attendedFromLegacyPercentage = typeof data.attendance === 'number' ? Math.round((data.attendance / 100) * totalClasses) : undefined;
  const attendedClasses = Math.min(
    Math.max(attendedFromNewField ?? attendedFromLegacyPercentage ?? 0, 0),
    totalClasses
  );

  const assignments = Array.isArray(data.assignments)
    ? (data.assignments as Partial<Assignment>[]).map(normalizeAssignment)
    : [];

  const messages = Array.isArray((data as Partial<Student>).messages)
    ? ((data as Partial<Student>).messages as Partial<StudentMessage>[]).map(normalizeMessage)
    : [];

  return {
    name: data.name ?? '',
    regNo: data.regNo ?? fallbackRegNo,
    attendedClasses,
    totalClasses,
    pendingAssignments: typeof data.pendingAssignments === 'number'
      ? data.pendingAssignments
      : getPendingAssignmentsCount(assignments, 0),
    isBlocked: typeof data.isBlocked === 'boolean' ? data.isBlocked : false,
    assignments,
    messages,
  };
};

const getAttendancePercentage = (student: Student): number => {
  if (!student.totalClasses) {
    return 0;
  }
  return Math.round((student.attendedClasses / student.totalClasses) * 100);
};

const formatDueDate = (isoString: string): string => {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(isoString));
  } catch (error) {
    console.warn('Unable to format due date', error);
    return 'TBD';
  }
};

const formatDateTime = (isoString: string): string => {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(isoString));
  } catch (error) {
    console.warn('Unable to format timestamp', error);
    return 'Just now';
  }
};

// --- HELPER COMPONENTS (defined outside main component) ---

const HomePage = ({ onSelectRole }: { onSelectRole: (page: Page) => void }) => (
  <div className="w-full">
    <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10">
      <div className="grid gap-12 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
        <div className="space-y-8">
          <div className="space-y-3">
            <span className="inline-flex items-center rounded-full bg-sky-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-sky-700">
              Smart Campus Portal
            </span>
            <h2 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Streamline academic oversight and keep every student aligned.
            </h2>
            <p className="text-base text-slate-600">
              VIT brings together attendance, assignments, and engagement analytics into a single calm interface. Switch between student and admin workspaces without losing context.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            <button
              type="button"
              onClick={() => onSelectRole(Page.StudentLogin)}
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_20px_45px_-25px_rgba(79,70,229,0.7)] transition-transform hover:-translate-y-0.5"
            >
              <UserIcon className="h-5 w-5" />
              Access Student Portal
            </button>
            <button
              type="button"
              onClick={() => onSelectRole(Page.AdminLogin)}
              className="inline-flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-[0_18px_35px_-25px_rgba(14,116,144,0.3)] transition-transform hover:-translate-y-0.5"
            >
              <ShieldCheckIcon className="h-5 w-5" />
              Launch Admin Console
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[{
              label: 'Active students',
              value: 'Realtime sync',
            }, {
              label: 'Attendance tracking',
              value: 'Per class insights',
            }, {
              label: 'Secure access',
              value: 'Role-driven dashboards',
            }].map(stat => (
              <Card key={stat.label} className="p-5">
                <p className="text-xs uppercase tracking-[0.35em] text-sky-500">{stat.label}</p>
                <p className="mt-2 text-lg font-semibold text-slate-800">{stat.value}</p>
              </Card>
            ))}
          </div>
        </div>
        <Card className="relative isolate overflow-hidden p-10">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-sky-100 via-blue-100 to-indigo-100" />
          <div className="absolute -right-20 -top-24 -z-20 h-56 w-56 rounded-full bg-sky-200/60 blur-3xl" />
          <div className="space-y-6">
            <h3 className="text-2xl font-semibold text-slate-900">Why campuses choose VIT</h3>
            <ul className="space-y-4 text-sm text-slate-600">
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-sky-500" />
                Unified attendance, assignment, and analytics in one experience.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-sky-500" />
                Instant updates across student dashboards with Firestore sync.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-sky-500" />
                Admin tooling to record attendance in batches within seconds.
              </li>
            </ul>
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600 lg:w-5/6">
              <p className="font-medium text-sky-600">Live snapshot</p>
              <p className="mt-1">Log in as admin to record today’s attendance and watch the student view update in real-time.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>
);

const StudentLoginPage = ({ onLogin, onBack }: { onLogin: (name: string, regNo: string) => Promise<string | null>, onBack: () => void }) => {
  const [name, setName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name || !regNo) {
      setError('Please fill in both fields.');
      return;
    }
    setIsSubmitting(true);
    try {
      const loginError = await onLogin(name.trim(), regNo.trim());
      if (loginError) {
        setError(loginError);
      }
    } catch (err) {
      console.error('Failed to login student', err);
      setError('Unable to complete login. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-lg space-y-10 p-10">
      <div className="space-y-3 text-center">
        <span className="text-xs uppercase tracking-[0.35em] text-sky-500">Student gateway</span>
        <h2 className="text-3xl font-semibold text-slate-900">Welcome back to VIT</h2>
        <p className="text-sm text-slate-500">Log in or register with your name and registration number to access personalised attendance insights.</p>
      </div>
      <form className="space-y-6" onSubmit={handleSubmit}>
        {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}
        <Input label="Full Name" id="name" type="text" placeholder="e.g. Priya Sharma" value={name} onChange={e => setName(e.target.value)} required />
        <Input label="Registration Number" id="regNo" type="text" placeholder="e.g. CS2025-014" value={regNo} onChange={e => setRegNo(e.target.value)} required />
        <div className="flex flex-col gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Processing...' : 'Continue to Dashboard'}
          </Button>
          <Button type="button" variant="secondary" onClick={onBack}>Back to Home</Button>
        </div>
      </form>
    </Card>
  );
};

const StudentDashboardPage = ({
  student,
  onViewAssignment,
}: {
  student: Student;
  onViewAssignment: (assignmentId: string) => void;
}) => {
  const attendancePercentage = getAttendancePercentage(student);
  const pendingAssignments = getPendingAssignmentsCount(student.assignments, student.pendingAssignments);
  const sortedMessages = [...student.messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="container mx-auto grid gap-8 px-4 py-10 sm:px-6 lg:grid-cols-12 lg:px-10">
      <Card className="relative overflow-hidden bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-100 text-slate-900 lg:col-span-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.15),_transparent_65%)]" />
        <div className="relative flex flex-col gap-6 p-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-sky-600">Student dashboard</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">Welcome back, {student.name}</h2>
            <p className="mt-3 text-sm text-slate-600">Registration • {student.regNo}</p>
          </div>
          <div className="flex items-center gap-5 rounded-2xl border border-slate-100 bg-white/80 px-6 py-4 shadow-inner">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sky-600">Attendance</p>
              <p className="text-3xl font-bold text-slate-900">{attendancePercentage}%</p>
            </div>
            <div className="text-xs leading-5 text-slate-600">
              <p>{student.attendedClasses} of {student.totalClasses} classes captured</p>
              <p>Stay above 75% to remain in good standing.</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="lg:col-span-5 xl:col-span-4">
        <div className="space-y-6 p-8">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Attendance pulse</h3>
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-600">Tracked daily</span>
          </div>
          <div>
            <div className="flex items-end justify-between">
              <p className="text-4xl font-bold text-sky-600">{attendancePercentage}%</p>
              <p className="text-sm text-slate-500">{student.attendedClasses}/{student.totalClasses} sessions</p>
            </div>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-blue-500 transition-all"
                style={{ width: `${Math.min(attendancePercentage, 100)}%` }}
              />
            </div>
          </div>
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sky-500" /> Consistent attendance unlocks priority lab slots.
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-400" /> Admin updates reflect here instantly with Firestore.
            </li>
          </ul>
        </div>
      </Card>

      <Card className="lg:col-span-4 xl:col-span-4">
        <div className="p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Assignments queue</h3>
              <p className="mt-1 text-sm text-slate-500">Tap an assignment to open full details and upload your work.</p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-sky-600">Pending</p>
              <p className="text-lg font-semibold text-sky-600">{pendingAssignments}</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {student.assignments.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 text-sm text-slate-500">
                You’re all caught up. New assignments will appear here when faculty publish them.
              </div>
            ) : (
              student.assignments.map(assignment => {
                const isSubmitted = assignment.status === 'submitted';
                return (
                  <button
                    type="button"
                    key={assignment.id}
                    onClick={() => onViewAssignment(assignment.id)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left transition-colors hover:border-sky-200 hover:bg-sky-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-base font-semibold text-slate-900">{assignment.title}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">Due {formatDueDate(assignment.dueDate)}</p>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                        isSubmitted
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-amber-100 text-amber-600'
                      }`}>
                        {isSubmitted ? 'Submitted' : 'Pending'}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{assignment.description}</p>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </Card>

      <Card className="lg:col-span-3 xl:col-span-4">
        <div className="space-y-5 p-8">
          <h3 className="text-lg font-semibold text-slate-900">Faculty touchpoints</h3>
          <ul className="space-y-4 text-sm text-slate-600">
            {MOCK_TEACHERS.map(teacher => (
              <li key={teacher.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div>
                  <p className="font-semibold text-slate-800">{teacher.name}</p>
                  <p className="text-xs uppercase tracking-[0.25em] text-sky-500">{teacher.subject}</p>
                </div>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-600">Office hours • 4-6 PM</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card className="lg:col-span-12">
        <div className="space-y-4 p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Messages from admin</h3>
              <p className="text-sm text-slate-500">Stay aligned with the latest updates, reminders, and deadlines.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
              {sortedMessages.length} {sortedMessages.length === 1 ? 'message' : 'messages'}
            </span>
          </div>

          {sortedMessages.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 text-sm text-slate-500">
              No announcements yet. Messages published by the admin will appear here instantly.
            </div>
          ) : (
            <div className="space-y-3">
              {sortedMessages.slice(0, 6).map(message => (
                <div key={message.id} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 transition-colors hover:border-sky-200 hover:bg-sky-50/80">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-base font-semibold text-slate-900">{message.title}</p>
                    <span className="text-xs uppercase tracking-[0.25em] text-slate-400">{formatDateTime(message.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{message.body}</p>
                </div>
              ))}
              {sortedMessages.length > 6 && (
                <p className="text-xs text-slate-400">Showing the latest 6 messages.</p>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

const AdminLoginPage = ({ onLogin, onBack }: { onLogin: (user: string, pass: string) => boolean, onBack: () => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = onLogin(username, password);
    setError(!success);
  };

  return (
    <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-[0_18px_35px_-20px_rgba(15,23,42,0.35)] space-y-8">
      <div>
        <h2 className="text-center text-3xl font-semibold text-slate-900">Admin Login</h2>
      </div>
      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
  {error && <p className="text-sm text-center text-rose-500">Invalid credentials</p>}
        <Input label="Username" id="username" type="text" value={username} onChange={e => setUsername(e.target.value)} required />
        <Input label="Password" id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        <div className="flex flex-col gap-4">
          <Button type="submit">Sign In</Button>
          <Button type="button" variant="secondary" onClick={onBack}>Back to Home</Button>
        </div>
      </form>
    </div>
  );
};

const AdminDashboardPage = ({
  students,
  onToggleBlock,
  onViewDetails,
  onOpenAttendance,
  isSavingAttendance,
  attendanceLocked,
  onDeleteStudent,
}: {
  students: Student[];
  onToggleBlock: (regNo: string) => Promise<void>;
  onViewDetails: (student: Student) => void;
  onOpenAttendance: () => void;
  isSavingAttendance: boolean;
  attendanceLocked: boolean;
  onDeleteStudent: (student: Student) => void;
}) => (
  <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-10">
    <Card className="w-full overflow-hidden">
      <div className="bg-gradient-to-r from-sky-100 via-blue-50 to-indigo-100 px-8 py-8 text-slate-900">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-sky-600">Admin command center</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">Registered Students</h2>
            <p className="mt-2 text-sm text-slate-600">Manage attendance, review profiles, and maintain discipline in one streamlined grid.</p>
          </div>
          <button
            type="button"
            onClick={onOpenAttendance}
            disabled={students.length === 0 || isSavingAttendance || attendanceLocked}
            className={`inline-flex items-center justify-center gap-3 rounded-2xl px-6 py-3 text-sm font-semibold shadow-[0_18px_45px_-25px_rgba(15,23,42,0.4)] transition-all ${
              students.length === 0 || isSavingAttendance || attendanceLocked
                ? 'bg-white/60 text-slate-400 cursor-not-allowed'
                : 'bg-slate-900 text-white hover:-translate-y-0.5'
            }`}
          >
            {isSavingAttendance
              ? 'Saving attendance...'
              : attendanceLocked
                ? 'Attendance complete'
                : 'Take today’s attendance'}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.25em] text-slate-500">
            <tr>
              <th scope="col" className="px-8 py-4">Name</th>
              <th scope="col" className="px-8 py-4">Reg No</th>
              <th scope="col" className="px-8 py-4">Attendance</th>
              <th scope="col" className="px-8 py-4">Status</th>
              <th scope="col" className="px-8 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white text-sm text-slate-600">
            {students.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-8 py-10 text-center text-slate-400">
                  No students registered yet. Encourage sign-ups through the student portal.
                </td>
              </tr>
            ) : (
              students.map(student => {
                const attendance = getAttendancePercentage(student);
                const pendingAssignmentsCount = getPendingAssignmentsCount(student.assignments, student.pendingAssignments);
                return (
                  <tr key={student.regNo} className="transition-colors hover:bg-sky-50/80">
                    <td className="px-8 py-5 font-semibold text-slate-900">{student.name}</td>
                    <td className="px-8 py-5">{student.regNo}</td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col gap-2">
                        <span className="font-semibold text-slate-700">{attendance}%</span>
                        <div className="h-2 w-40 rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-500"
                            style={{ width: `${Math.min(attendance, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400">{student.attendedClasses}/{student.totalClasses} classes</span>
                        <span className="text-xs text-sky-500">{pendingAssignmentsCount} assignments pending</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold ${
                        student.isBlocked
                          ? 'bg-rose-100 text-rose-600'
                          : 'bg-emerald-100 text-emerald-600'
                      }`}>
                        {student.isBlocked ? 'Blocked' : 'Active'}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => onViewDetails(student)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sky-200 text-sky-600 transition-colors hover:bg-sky-500 hover:text-white"
                          title="View Details"
                        >
                          <EyeIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => onToggleBlock(student.regNo)}
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                            student.isBlocked
                              ? 'border border-emerald-200 text-emerald-500 hover:bg-emerald-500 hover:text-white'
                              : 'border border-rose-200 text-rose-500 hover:bg-rose-500 hover:text-white'
                          }`}
                          title={student.isBlocked ? 'Unblock Student' : 'Block Student'}
                        >
                          {student.isBlocked ? <LockOpenIcon className="h-5 w-5" /> : <LockClosedIcon className="h-5 w-5" />}
                        </button>
                        <button
                          onClick={() => onDeleteStudent(student)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 text-rose-500 transition-colors hover:bg-rose-600 hover:text-white"
                          title="Delete Student"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  </div>
);


// --- MAIN APP COMPONENT ---

function App() {
  const [page, setPage] = useState<Page>(Page.Home);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [attendanceSelections, setAttendanceSelections] = useState<Record<string, boolean>>({});
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [assignmentModal, setAssignmentModal] = useState<{ studentRegNo: string; assignmentId: string } | null>(null);
  const [assignmentUploadFile, setAssignmentUploadFile] = useState<File | null>(null);
  const [assignmentUploadError, setAssignmentUploadError] = useState<string | null>(null);
  const [assignmentUploadSuccess, setAssignmentUploadSuccess] = useState<string | null>(null);
  const [isUploadingAssignment, setIsUploadingAssignment] = useState(false);
  const [isAssignmentFormVisible, setIsAssignmentFormVisible] = useState(false);
  const [assignmentDraft, setAssignmentDraft] = useState({
    title: '',
    description: '',
    dueDate: '',
    resourceLink: '',
  });
  const [assignmentFormError, setAssignmentFormError] = useState<string | null>(null);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [isMessageFormVisible, setIsMessageFormVisible] = useState(false);
  const [messageDraft, setMessageDraft] = useState({ title: '', body: '' });
  const [messageFormError, setMessageFormError] = useState<string | null>(null);
  const [isSavingMessage, setIsSavingMessage] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'students'),
      snapshot => {
        const fetchedStudents = snapshot.docs
          .map(docSnapshot => normalizeStudentData(docSnapshot.data() as RawStudentDoc, docSnapshot.id))
          .sort((a, b) => a.regNo.localeCompare(b.regNo));
        setStudents(fetchedStudents);
      },
      error => {
        console.error('Failed to load students', error);
      }
    );

    return unsubscribe;
  }, []);

  const handleStudentLogin = useCallback(async (name: string, regNo: string): Promise<string | null> => {
    const trimmedName = name.trim();
    const trimmedRegNo = regNo.trim();

    if (!trimmedName || !trimmedRegNo) {
      return 'Please fill in both fields.';
    }

  const studentRef = doc(db, 'students', trimmedRegNo);

    try {
      const studentSnapshot = await getDoc(studentRef);

      if (studentSnapshot.exists()) {
        const existingStudent = normalizeStudentData(studentSnapshot.data() as RawStudentDoc, trimmedRegNo);

        if (existingStudent.isBlocked) {
          return 'Your account is blocked. Please contact administration.';
        }

        if (existingStudent.name.toLowerCase() !== trimmedName.toLowerCase()) {
          return 'Registration number found, but name does not match.';
        }

        setCurrentUser({ ...existingStudent, role: 'student' });
        setPage(Page.StudentDashboard);
        return null;
      }

      const newStudent: Student = {
        name: trimmedName,
        regNo: trimmedRegNo,
        attendedClasses: 0,
        totalClasses: TOTAL_CLASSES,
        pendingAssignments: 0,
        isBlocked: false,
        assignments: [],
        messages: [],
      };

      await setDoc(studentRef, newStudent);

      setCurrentUser({ ...newStudent, role: 'student' });
      setPage(Page.StudentDashboard);
      return null;
    } catch (error) {
      console.error('Failed to handle student login', error);
      return 'Unexpected error during login. Please try again.';
    }
  }, [setCurrentUser, setPage]);

  const handleAdminLogin = useCallback((username: string, pass: string): boolean => {
    if (username === 'admin' && pass === 'admin') {
      setCurrentUser({ role: 'admin' });
      setPage(Page.AdminDashboard);
      return true;
    }
    return false;
  }, []);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    setPage(Page.Home);
  }, []);

  const handleToggleBlock = useCallback(async (regNo: string) => {
    const student = students.find(s => s.regNo === regNo);
    if (!student) {
      console.warn('Student not found while attempting to toggle block state.', regNo);
      return;
    }

    try {
  const studentRef = doc(db, 'students', regNo);
      await updateDoc(studentRef, { isBlocked: !student.isBlocked });
    } catch (error) {
      console.error('Failed to toggle block status for student', error);
    }
  }, [students]);

  const handleRequestDeleteStudent = useCallback((student: Student) => {
    setStudentToDelete(student);
    setDeleteError(null);
  }, []);

  const handleCancelDeleteStudent = useCallback(() => {
    if (isDeletingStudent) {
      return;
    }
    setStudentToDelete(null);
    setDeleteError(null);
  }, [isDeletingStudent]);

  const handleConfirmDeleteStudent = useCallback(async () => {
    if (!studentToDelete) {
      return;
    }

    setIsDeletingStudent(true);
    setDeleteError(null);

    try {
      await deleteDoc(doc(db, 'students', studentToDelete.regNo));

      if (currentUser?.role === 'student' && currentUser.regNo === studentToDelete.regNo) {
        setCurrentUser(null);
        setPage(Page.StudentLogin);
      }

      setStudentToDelete(null);
    } catch (error) {
      console.error('Failed to delete student', error);
      setDeleteError('Unable to delete student. Please try again.');
    } finally {
      setIsDeletingStudent(false);
    }
  }, [studentToDelete, currentUser, setCurrentUser, setPage]);

  const handleOpenAssignmentModal = useCallback((regNo: string, assignmentId: string) => {
    setAssignmentModal({ studentRegNo: regNo, assignmentId });
    setAssignmentUploadError(null);
    setAssignmentUploadSuccess(null);
    setAssignmentUploadFile(null);
  }, []);

  const handleCloseAssignmentModal = useCallback(() => {
    if (isUploadingAssignment) {
      return;
    }
    setAssignmentModal(null);
    setAssignmentUploadFile(null);
    setAssignmentUploadError(null);
    setAssignmentUploadSuccess(null);
  }, [isUploadingAssignment]);

  const assignmentModalData = useMemo<{ student: Student; assignment: Assignment } | null>(() => {
    if (!assignmentModal) {
      return null;
    }

    const student = students.find(s => s.regNo === assignmentModal.studentRegNo);
    if (!student) {
      return null;
    }

    const assignment = student.assignments.find(item => item.id === assignmentModal.assignmentId);
    if (!assignment) {
      return null;
    }

    return { student, assignment };
  }, [assignmentModal, students]);

  useEffect(() => {
    if (!assignmentModal) {
      return;
    }

    const student = students.find(s => s.regNo === assignmentModal.studentRegNo);
    if (!student) {
      handleCloseAssignmentModal();
      return;
    }

    const assignmentExists = student.assignments.some(item => item.id === assignmentModal.assignmentId);
    if (!assignmentExists) {
      handleCloseAssignmentModal();
    }
  }, [assignmentModal, students, handleCloseAssignmentModal]);

  const isStudentOwnerForAssignmentModal =
    !!assignmentModalData &&
    currentUser?.role === 'student' &&
    currentUser.regNo === assignmentModalData.student.regNo;

  const handleSubmitAssignmentUpload = useCallback(async () => {
    if (!assignmentModalData) {
      setAssignmentUploadError('No assignment selected. Please reopen the task and try again.');
      return;
    }

    if (!assignmentUploadFile) {
      setAssignmentUploadError('Please choose a file before uploading.');
      return;
    }

    if (!currentUser || currentUser.role !== 'student' || currentUser.regNo !== assignmentModalData.student.regNo) {
      setAssignmentUploadError('Only the assigned student can submit this assignment.');
      return;
    }

    const file = assignmentUploadFile;
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      setAssignmentUploadError('File is too large. Please keep submissions under 10 MB.');
      return;
    }

    setIsUploadingAssignment(true);
    setAssignmentUploadError(null);
    setAssignmentUploadSuccess(null);

    try {
      const { student, assignment } = assignmentModalData;
      const sanitizedName = file.name.replace(/\s+/g, '-');
      const storageRef = ref(
        storage,
        `assignments/${student.regNo}/${assignment.id}/${Date.now()}-${sanitizedName}`,
      );

      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      const updatedAssignments = student.assignments.map(item =>
        item.id === assignment.id
          ? {
              ...item,
              status: 'submitted',
              submissionUrl: downloadUrl,
              submissionName: file.name,
              submittedAt: new Date().toISOString(),
            }
          : item
      );

      await updateDoc(doc(db, 'students', student.regNo), {
        assignments: updatedAssignments,
        pendingAssignments: getPendingAssignmentsCount(updatedAssignments, 0),
      });

      setAssignmentUploadSuccess('Upload complete! Your submission is now tracked.');
      setAssignmentUploadFile(null);
    } catch (error) {
      console.error('Failed to upload assignment submission', error);
      setAssignmentUploadError('Upload failed. Please check your connection and try again.');
    } finally {
      setIsUploadingAssignment(false);
    }
  }, [assignmentModalData, assignmentUploadFile, currentUser]);

  const handleToggleAssignmentForm = useCallback(() => {
    setIsAssignmentFormVisible(prev => {
      const next = !prev;
      if (next) {
        setIsMessageFormVisible(false);
        setMessageDraft({ title: '', body: '' });
        setMessageFormError(null);
        setIsSavingMessage(false);
      }
      return next;
    });
    setAssignmentFormError(null);
  }, []);

  const handleAssignmentDraftChange = useCallback(
    (field: 'title' | 'description' | 'dueDate' | 'resourceLink', value: string) => {
      setAssignmentDraft(prev => ({
        ...prev,
        [field]: value,
      }));
    },
    [],
  );

  const handleCreateAssignment = useCallback(async () => {
    if (!selectedStudent) {
      return;
    }

    const trimmedTitle = assignmentDraft.title.trim();
    const trimmedDescription = assignmentDraft.description.trim();
    const trimmedLink = assignmentDraft.resourceLink.trim();

    if (!trimmedTitle) {
      setAssignmentFormError('Please provide a title for the assignment.');
      return;
    }

    if (!assignmentDraft.dueDate) {
      setAssignmentFormError('Select a due date so the student knows the deadline.');
      return;
    }

    let dueDateIso = '';
    try {
      dueDateIso = new Date(assignmentDraft.dueDate).toISOString();
    } catch (error) {
      setAssignmentFormError('The due date looks invalid. Choose a valid date.');
      return;
    }

    setIsSavingAssignment(true);
    setAssignmentFormError(null);

    try {
      const latestStudent = students.find(s => s.regNo === selectedStudent.regNo);
      if (!latestStudent) {
        throw new Error('Student not found while creating assignment.');
      }

      const newAssignment: Assignment = {
        id: makeAssignmentId(),
        title: trimmedTitle,
        description: trimmedDescription || 'No description provided.',
        dueDate: dueDateIso,
        status: 'pending',
        resourceLink: trimmedLink ? trimmedLink : null,
        submissionUrl: null,
        submissionName: null,
        submittedAt: null,
      };

      const updatedAssignments = [...latestStudent.assignments, newAssignment];

      await updateDoc(doc(db, 'students', latestStudent.regNo), {
        assignments: updatedAssignments,
        pendingAssignments: getPendingAssignmentsCount(updatedAssignments, 0),
      });

      setAssignmentDraft({
        title: '',
        description: '',
        dueDate: '',
        resourceLink: '',
      });
      setIsAssignmentFormVisible(false);
    } catch (error) {
      console.error('Failed to create assignment', error);
      setAssignmentFormError('Unable to add the assignment. Please try again.');
    } finally {
      setIsSavingAssignment(false);
    }
  }, [assignmentDraft, selectedStudent, students]);

  const handleToggleMessageForm = useCallback(() => {
    setIsMessageFormVisible(prev => {
      const next = !prev;
      if (next) {
        setIsAssignmentFormVisible(false);
        setAssignmentDraft({ title: '', description: '', dueDate: '', resourceLink: '' });
        setAssignmentFormError(null);
        setIsSavingAssignment(false);
      }
      return next;
    });
    setMessageFormError(null);
  }, []);

  const handleMessageDraftChange = useCallback((field: 'title' | 'body', value: string) => {
    setMessageDraft(prev => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleCreateMessage = useCallback(async () => {
    if (!selectedStudent) {
      return;
    }

    const trimmedTitle = messageDraft.title.trim();
    const trimmedBody = messageDraft.body.trim();

    if (!trimmedTitle) {
      setMessageFormError('Please add a subject for this message.');
      return;
    }

    if (!trimmedBody) {
      setMessageFormError('Please write a message before sending.');
      return;
    }

    setIsSavingMessage(true);
    setMessageFormError(null);

    try {
      const latestStudent = students.find(s => s.regNo === selectedStudent.regNo);
      if (!latestStudent) {
        throw new Error('Student not found while sending message.');
      }

      const newMessage: StudentMessage = {
        id: makeMessageId(),
        title: trimmedTitle,
        body: trimmedBody,
        createdAt: new Date().toISOString(),
        sender: 'admin',
      };

      const updatedMessages = [...latestStudent.messages, newMessage];

      await updateDoc(doc(db, 'students', latestStudent.regNo), {
        messages: updatedMessages,
      });

      setMessageDraft({ title: '', body: '' });
      setIsMessageFormVisible(false);
    } catch (error) {
      console.error('Failed to send message', error);
      setMessageFormError('Unable to send the message. Please try again.');
    } finally {
      setIsSavingMessage(false);
    }
  }, [messageDraft, selectedStudent, students]);

  const handleOpenAttendanceModal = useCallback(() => {
    if (!students.length) {
      return;
    }

    const initialSelections = students.reduce<Record<string, boolean>>((acc, student) => {
      acc[student.regNo] = false;
      return acc;
    }, {});

    setAttendanceSelections(initialSelections);
    setAttendanceError(null);
    setIsAttendanceModalOpen(true);
  }, [students]);

  const handleCloseAttendanceModal = useCallback(() => {
    setIsAttendanceModalOpen(false);
    setAttendanceSelections({});
    setAttendanceError(null);
  }, []);

  const handleToggleAttendanceSelection = useCallback((regNo: string) => {
    setAttendanceSelections(prev => ({
      ...prev,
      [regNo]: !prev[regNo],
    }));
  }, []);

  const handleMarkAllPresent = useCallback(() => {
    setAttendanceSelections(prev => {
      let hasChanges = false;
      const updated = { ...prev };
      students.forEach(student => {
        if (student.attendedClasses < student.totalClasses && !updated[student.regNo]) {
          updated[student.regNo] = true;
          hasChanges = true;
        }
      });
      return hasChanges ? updated : prev;
    });
  }, [students]);

  const handleSubmitAttendance = useCallback(async () => {
    setAttendanceError(null);
    setIsSavingAttendance(true);

    try {
      await Promise.all(
        Object.entries(attendanceSelections).map(async ([regNo, present]) => {
          if (!present) {
            return;
          }

          const student = students.find(s => s.regNo === regNo);
          if (!student) {
            console.warn('Student not found while recording attendance.', regNo);
            return;
          }

          if (student.attendedClasses >= student.totalClasses) {
            return;
          }

          const studentRef = doc(db, 'students', regNo);
          await updateDoc(studentRef, {
            attendedClasses: Math.min(student.attendedClasses + 1, student.totalClasses),
          });
        })
      );

      handleCloseAttendanceModal();
    } catch (error) {
      console.error('Failed to record attendance', error);
      setAttendanceError('Unable to record attendance. Please try again.');
    } finally {
      setIsSavingAttendance(false);
    }
  }, [attendanceSelections, students, handleCloseAttendanceModal]);
  
  const handleViewDetails = (student: Student) => {
    setSelectedStudent(student);
  };
  
  const handleCloseModal = () => {
    setSelectedStudent(null);
  }

  useEffect(() => {
    if (!selectedStudent) {
      return;
    }

    const updatedStudent = students.find(s => s.regNo === selectedStudent.regNo);

    if (!updatedStudent) {
      setSelectedStudent(null);
      return;
    }

    const hasChanges =
      updatedStudent.attendedClasses !== selectedStudent.attendedClasses ||
      updatedStudent.totalClasses !== selectedStudent.totalClasses ||
      updatedStudent.pendingAssignments !== selectedStudent.pendingAssignments ||
      updatedStudent.isBlocked !== selectedStudent.isBlocked ||
      updatedStudent.name !== selectedStudent.name ||
      JSON.stringify(updatedStudent.assignments) !== JSON.stringify(selectedStudent.assignments) ||
      JSON.stringify(updatedStudent.messages) !== JSON.stringify(selectedStudent.messages);

    if (hasChanges) {
      setSelectedStudent(updatedStudent);
    }
  }, [students, selectedStudent]);

  useEffect(() => {
    if (!selectedStudent) {
      setIsAssignmentFormVisible(false);
      setAssignmentDraft({ title: '', description: '', dueDate: '', resourceLink: '' });
      setAssignmentFormError(null);
      setIsSavingAssignment(false);
      setIsMessageFormVisible(false);
      setMessageDraft({ title: '', body: '' });
      setMessageFormError(null);
      setIsSavingMessage(false);
      return;
    }

    setIsAssignmentFormVisible(false);
    setAssignmentDraft({ title: '', description: '', dueDate: '', resourceLink: '' });
    setAssignmentFormError(null);
    setIsSavingAssignment(false);
    setIsMessageFormVisible(false);
    setMessageDraft({ title: '', body: '' });
    setMessageFormError(null);
    setIsSavingMessage(false);
  }, [selectedStudent]);

  useEffect(() => {
    if (currentUser?.role !== 'student') {
      return;
    }

    const updated = students.find(s => s.regNo === currentUser.regNo);
    if (!updated) {
      setCurrentUser(null);
      setPage(Page.StudentLogin);
      return;
    }

    if (
      updated.attendedClasses !== currentUser.attendedClasses ||
      updated.totalClasses !== currentUser.totalClasses ||
      updated.pendingAssignments !== currentUser.pendingAssignments ||
      updated.isBlocked !== currentUser.isBlocked ||
      updated.name !== currentUser.name ||
      JSON.stringify(updated.assignments) !== JSON.stringify(currentUser.assignments) ||
      JSON.stringify(updated.messages) !== JSON.stringify(currentUser.messages)
    ) {
      setCurrentUser({ ...updated, role: 'student' });
    }
  }, [students, currentUser]);

  const attendanceLocked = useMemo(
    () =>
      students.length > 0 && students.every(student => student.attendedClasses >= student.totalClasses),
    [students]
  );

  useEffect(() => {
    if (!isAttendanceModalOpen) {
      return;
    }

    setAttendanceSelections(prev => {
      const nextSelections: Record<string, boolean> = {};
      students.forEach(student => {
        nextSelections[student.regNo] = prev[student.regNo] ?? false;
      });
      return nextSelections;
    });
  }, [students, isAttendanceModalOpen]);

  useEffect(() => {
    if (!studentToDelete) {
      return;
    }

    const exists = students.some(s => s.regNo === studentToDelete.regNo);
    if (!exists) {
      setStudentToDelete(null);
      setDeleteError(null);
      setIsDeletingStudent(false);
    }
  }, [students, studentToDelete]);

  const renderPage = () => {
    switch (page) {
      case Page.StudentLogin:
        return <StudentLoginPage onLogin={handleStudentLogin} onBack={() => setPage(Page.Home)} />;
      case Page.StudentDashboard:
        if (currentUser?.role === 'student') {
          return (
            <StudentDashboardPage
              student={currentUser}
              onViewAssignment={assignmentId => handleOpenAssignmentModal(currentUser.regNo, assignmentId)}
            />
          );
        }
        return null;
      case Page.AdminLogin:
        return <AdminLoginPage onLogin={handleAdminLogin} onBack={() => setPage(Page.Home)} />;
      case Page.AdminDashboard:
        return (
          <AdminDashboardPage
            students={students}
            onToggleBlock={handleToggleBlock}
            onViewDetails={handleViewDetails}
            onOpenAttendance={handleOpenAttendanceModal}
            isSavingAttendance={isSavingAttendance}
            attendanceLocked={attendanceLocked}
            onDeleteStudent={handleRequestDeleteStudent}
          />
        );
      case Page.Home:
      default:
        return <HomePage onSelectRole={setPage} />;
    }
  };

  const mainContentClasses = useMemo(() => {
    if (page === Page.StudentDashboard || page === Page.AdminDashboard) {
      return "flex-grow py-14";
    }
    return "flex-grow flex items-center justify-center px-4 py-16";
  }, [page]);


  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-white via-slate-50 to-sky-50 text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(125,211,252,0.22),_transparent_60%)]" />
      <Header userRole={currentUser?.role} onLogout={handleLogout} />
      <main className={`${mainContentClasses} relative z-10`}>
        <div className="w-full">
          {renderPage()}
        </div>
      </main>
      <Modal isOpen={isAttendanceModalOpen} onClose={handleCloseAttendanceModal} title="Take Attendance">
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              Select the students who are present. Each save adds one attended class (max {TOTAL_CLASSES}).
            </p>
            <button
              type="button"
              onClick={handleMarkAllPresent}
              disabled={isSavingAttendance || attendanceLocked || students.length === 0}
              className={`inline-flex items-center justify-center rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                isSavingAttendance || attendanceLocked || students.length === 0
                  ? 'border-gray-300 text-gray-400 cursor-not-allowed'
                  : 'border-sky-200 text-sky-600 hover:bg-sky-50'
              }`}
            >
              Mark All Present
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto space-y-3">
            {students.length === 0 ? (
              <p className="text-sm text-slate-500">No students registered yet.</p>
            ) : (
              students.map(student => {
                const checkboxChecked = attendanceSelections[student.regNo] ?? false;
                const reachedLimit = student.attendedClasses >= student.totalClasses;
                return (
                  <label
                    key={student.regNo}
                    className={`flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 ${
                      reachedLimit ? 'opacity-60' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checkboxChecked}
                      onChange={() => handleToggleAttendanceSelection(student.regNo)}
                      disabled={reachedLimit || isSavingAttendance}
                      className="h-4 w-4 accent-sky-500"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-900">{student.name}</span>
                      <span className="text-xs text-slate-500">
                        {student.regNo} • {getAttendancePercentage(student)}% ({student.attendedClasses}/{student.totalClasses})
                      </span>
                      {reachedLimit && (
                        <span className="text-xs text-sky-500">Attendance complete</span>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>
          {attendanceError && <p className="text-sm text-red-500">{attendanceError}</p>}
          <div className="flex flex-col gap-2">
            <Button type="button" onClick={handleSubmitAttendance} disabled={isSavingAttendance || attendanceLocked || students.length === 0}>
              {isSavingAttendance ? 'Saving...' : 'Save Attendance'}
            </Button>
            <Button type="button" variant="secondary" onClick={handleCloseAttendanceModal} disabled={isSavingAttendance}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={!!studentToDelete}
        onClose={handleCancelDeleteStudent}
        title={studentToDelete ? `Delete ${studentToDelete.name}?` : 'Delete student'}
      >
        {studentToDelete && (
          <div className="space-y-5">
            <p className="text-sm text-slate-600">
              This action permanently removes the student record, including attendance history and assignments data. The student can register again later and will start with a clean slate.
            </p>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-600">
              <p><strong className="font-semibold">Name:</strong> {studentToDelete.name}</p>
              <p><strong className="font-semibold">Reg No:</strong> {studentToDelete.regNo}</p>
              <p><strong className="font-semibold">Attendance captured:</strong> {studentToDelete.attendedClasses}/{studentToDelete.totalClasses}</p>
            </div>
            {deleteError && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{deleteError}</p>}
            <div className="flex flex-col gap-3">
              <Button
                type="button"
                variant="danger"
                onClick={handleConfirmDeleteStudent}
                disabled={isDeletingStudent}
              >
                {isDeletingStudent ? 'Deleting...' : 'Delete student record'}
              </Button>
              <Button type="button" variant="secondary" onClick={handleCancelDeleteStudent} disabled={isDeletingStudent}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <Modal isOpen={!!selectedStudent} onClose={handleCloseModal} title={`Details for ${selectedStudent?.name}`}>
        {selectedStudent && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 text-sm text-slate-600">
              <p className="flex justify-between"><span className="font-medium text-slate-500">Registration</span><span className="font-semibold text-slate-900">{selectedStudent.regNo}</span></p>
              <p className="mt-2 flex justify-between"><span className="font-medium text-slate-500">Attendance</span><span className="font-semibold text-indigo-600">{getAttendancePercentage(selectedStudent)}% ({selectedStudent.attendedClasses}/{selectedStudent.totalClasses})</span></p>
              <p className="mt-2 flex justify-between"><span className="font-medium text-slate-500">Pending assignments</span><span className="font-semibold text-amber-500">{getPendingAssignmentsCount(selectedStudent.assignments, selectedStudent.pendingAssignments)}</span></p>
              <p className="mt-2 flex justify-between"><span className="font-medium text-slate-500">Status</span><span className={selectedStudent.isBlocked ? 'font-semibold text-rose-500' : 'font-semibold text-emerald-500'}>{selectedStudent.isBlocked ? 'Blocked' : 'Active'}</span></p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Assignments</h4>
                <span className="text-xs text-slate-400">{selectedStudent.assignments.length} total</span>
              </div>
              {selectedStudent.assignments.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                  No assignments published yet for this student.
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedStudent.assignments.map(assignment => (
                    <div key={assignment.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-slate-900">{assignment.title}</p>
                          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Due {formatDueDate(assignment.dueDate)}</p>
                        </div>
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                          assignment.status === 'submitted'
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-amber-100 text-amber-600'
                        }`}>
                          {assignment.status === 'submitted' ? 'Submitted' : 'Pending'}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{assignment.description}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        {assignment.resourceLink && (
                          <a
                            href={assignment.resourceLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border border-indigo-200 px-3 py-1 text-indigo-600 transition-colors hover:bg-indigo-50"
                          >
                            View resources
                          </a>
                        )}
                        {assignment.submissionUrl && (
                          <a
                            href={assignment.submissionUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border border-emerald-200 px-3 py-1 text-emerald-600 transition-colors hover:bg-emerald-50"
                          >
                            View submission
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenAssignmentModal(selectedStudent.regNo, assignment.id)}
                          className="rounded-full border border-slate-200 px-3 py-1 text-slate-600 transition-colors hover:bg-slate-100"
                        >
                          Open details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Messages</h4>
                <span className="text-xs text-slate-400">{selectedStudent.messages.length} total</span>
              </div>
              {selectedStudent.messages.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                  No messages sent yet. Use the controls below to share announcements with this student.
                </p>
              ) : (
                <div className="space-y-3">
                  {[...selectedStudent.messages]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map(message => (
                      <div key={message.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-base font-semibold text-slate-900">{message.title}</p>
                          <span className="text-xs uppercase tracking-[0.25em] text-slate-400">{formatDateTime(message.createdAt)}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{message.body}</p>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {currentUser?.role === 'admin' && (
              <div className="space-y-4 border-t border-slate-200 pt-5">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="button" variant="secondary" onClick={handleToggleAssignmentForm}>
                    {isAssignmentFormVisible ? 'Cancel assignment draft' : 'Add assignment'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleToggleMessageForm}>
                    {isMessageFormVisible ? 'Cancel message' : 'Send message'}
                  </Button>
                </div>
                {isAssignmentFormVisible && (
                  <form
                    className="space-y-4"
                    onSubmit={event => {
                      event.preventDefault();
                      handleCreateAssignment();
                    }}
                  >
                    <Input
                      label="Title"
                      id="assignment-title"
                      type="text"
                      value={assignmentDraft.title}
                      onChange={event => handleAssignmentDraftChange('title', event.target.value)}
                      required
                    />
                    <div>
                      <label htmlFor="assignment-description" className="mb-2 block text-sm font-medium text-slate-600">Description</label>
                      <textarea
                        id="assignment-description"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition-colors focus:border-indigo-400 focus:outline-none"
                        rows={4}
                        value={assignmentDraft.description}
                        onChange={event => handleAssignmentDraftChange('description', event.target.value)}
                        placeholder="Add guidance, expectations, and submission instructions."
                      />
                    </div>
                    <Input
                      label="Due date"
                      id="assignment-due"
                      type="date"
                      value={assignmentDraft.dueDate}
                      onChange={event => handleAssignmentDraftChange('dueDate', event.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                    <Input
                      label="Resource link (optional)"
                      id="assignment-resource"
                      type="url"
                      value={assignmentDraft.resourceLink}
                      onChange={event => handleAssignmentDraftChange('resourceLink', event.target.value)}
                      placeholder="https://..."
                    />
                    {assignmentFormError && (
                      <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                        {assignmentFormError}
                      </p>
                    )}
                    <Button type="submit" disabled={isSavingAssignment}>
                      {isSavingAssignment ? 'Publishing...' : 'Publish assignment'}
                    </Button>
                  </form>
                )}
                {isMessageFormVisible && (
                  <form
                    className="space-y-4"
                    onSubmit={event => {
                      event.preventDefault();
                      handleCreateMessage();
                    }}
                  >
                    <Input
                      label="Subject"
                      id="message-title"
                      type="text"
                      value={messageDraft.title}
                      onChange={event => handleMessageDraftChange('title', event.target.value)}
                      required
                    />
                    <div>
                      <label htmlFor="message-body" className="mb-2 block text-sm font-medium text-slate-600">Message</label>
                      <textarea
                        id="message-body"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition-colors focus:border-indigo-400 focus:outline-none"
                        rows={4}
                        value={messageDraft.body}
                        onChange={event => handleMessageDraftChange('body', event.target.value)}
                        placeholder="Share reminders, appreciation, or action items."
                        required
                      />
                    </div>
                    {messageFormError && (
                      <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                        {messageFormError}
                      </p>
                    )}
                    <Button type="submit" disabled={isSavingMessage}>
                      {isSavingMessage ? 'Sending...' : 'Send message'}
                    </Button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
      <Modal
        isOpen={!!assignmentModalData}
        onClose={handleCloseAssignmentModal}
        title={assignmentModalData ? assignmentModalData.assignment.title : 'Assignment details'}
      >
        {assignmentModalData && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 text-sm text-slate-600">
              <p className="flex justify-between"><span className="font-medium text-slate-500">Due date</span><span className="font-semibold text-slate-900">{formatDueDate(assignmentModalData.assignment.dueDate)}</span></p>
              <p className="mt-2 flex justify-between"><span className="font-medium text-slate-500">Status</span><span className={assignmentModalData.assignment.status === 'submitted' ? 'font-semibold text-emerald-500' : 'font-semibold text-amber-500'}>{assignmentModalData.assignment.status === 'submitted' ? 'Submitted' : 'Pending'}</span></p>
              <p className="mt-2 flex justify-between"><span className="font-medium text-slate-500">Student</span><span className="font-semibold text-slate-900">{assignmentModalData.student.name}</span></p>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Overview</h4>
              <p className="text-sm leading-relaxed text-slate-600">{assignmentModalData.assignment.description}</p>
              {assignmentModalData.assignment.resourceLink && (
                <a
                  href={assignmentModalData.assignment.resourceLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
                >
                  Open reference material
                </a>
              )}
            </div>

            {assignmentModalData.assignment.submissionUrl ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-600">
                <p className="font-semibold">Submission on file</p>
                <p className="mt-1">{assignmentModalData.assignment.submissionName ?? 'Uploaded file'}</p>
                {assignmentModalData.assignment.submittedAt && (
                  <p className="mt-1 text-xs">Submitted on {new Date(assignmentModalData.assignment.submittedAt).toLocaleString()}</p>
                )}
                <a
                  href={assignmentModalData.assignment.submissionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center justify-center rounded-full border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-600 transition-colors hover:bg-emerald-100"
                >
                  Download submission
                </a>
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-600">
                <p>No submission uploaded yet.</p>
              </div>
            )}

            {isStudentOwnerForAssignmentModal && (
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Upload your work</p>
                  <p className="text-xs text-slate-500">We accept common document formats. Uploading again replaces your previous submission.</p>
                </div>
                <input
                  type="file"
                  onChange={event => {
                    const file = event.target.files?.[0] ?? null;
                    setAssignmentUploadFile(file);
                    setAssignmentUploadError(null);
                    setAssignmentUploadSuccess(null);
                  }}
                  disabled={isUploadingAssignment}
                  className="block w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm transition-colors focus:border-indigo-400 focus:outline-none"
                />
                {assignmentUploadFile && (
                  <p className="text-xs text-slate-500">Selected file: {assignmentUploadFile.name}</p>
                )}
                {assignmentUploadError && (
                  <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                    {assignmentUploadError}
                  </p>
                )}
                {assignmentUploadSuccess && (
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600">
                    {assignmentUploadSuccess}
                  </p>
                )}
                <Button
                  type="button"
                  onClick={handleSubmitAssignmentUpload}
                  disabled={isUploadingAssignment || !assignmentUploadFile}
                >
                  {isUploadingAssignment ? 'Uploading...' : assignmentModalData.assignment.status === 'submitted' ? 'Replace submission' : 'Upload submission'}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default App;
