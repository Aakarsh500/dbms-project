
import React, { useState, useCallback, useMemo } from 'react';
import { Page, Student, Teacher, User } from './types';
import Header from './components/Header';
import Card from './components/Card';
import Button from './components/Button';
import Input from './components/Input';
import Modal from './components/Modal';
import { UserIcon, ShieldCheckIcon, EyeIcon, LockClosedIcon, LockOpenIcon } from './components/icons';

// --- MOCK DATA ---
const MOCK_TEACHERS: Teacher[] = [
  { id: 1, name: 'Dr. Evelyn Reed', subject: 'Quantum Physics' },
  { id: 2, name: 'Mr. Samuel Drake', subject: 'Ancient History' },
  { id: 3, name: 'Ms. Clara Oswald', subject: 'Computer Science' },
  { id: 4, name: 'Prof. Alistair Finch', subject: 'Literature' },
];

// --- HELPER COMPONENTS (defined outside main component) ---

const HomePage = ({ onSelectRole }: { onSelectRole: (page: Page) => void }) => (
  <div className="flex flex-col md:flex-row items-center justify-center gap-8 p-8">
    <Card onClick={() => onSelectRole(Page.StudentLogin)} className="w-full md:w-80 text-center">
      <div className="p-8">
        <UserIcon className="w-16 h-16 mx-auto text-indigo-500" />
        <h2 className="mt-4 text-2xl font-bold text-gray-800 dark:text-white">Student Portal</h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Login to view your attendance, assignments, and more.</p>
      </div>
    </Card>
    <Card onClick={() => onSelectRole(Page.AdminLogin)} className="w-full md:w-80 text-center">
      <div className="p-8">
        <ShieldCheckIcon className="w-16 h-16 mx-auto text-indigo-500" />
        <h2 className="mt-4 text-2xl font-bold text-gray-800 dark:text-white">Admin Portal</h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Manage student records and system settings.</p>
      </div>
    </Card>
  </div>
);

const StudentLoginPage = ({ onLogin, onBack }: { onLogin: (name: string, regNo: string) => string | null, onBack: () => void }) => {
  const [name, setName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name || !regNo) {
      setError('Please fill in both fields.');
      return;
    }
    const loginError = onLogin(name, regNo);
    if (loginError) {
      setError(loginError);
    }
  };

  return (
    <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-gray-800 shadow-lg rounded-xl">
      <div>
        <h2 className="text-center text-3xl font-extrabold text-gray-900 dark:text-white">Student Portal</h2>
      </div>
      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        {error && <p className="text-sm text-red-500 text-center">{error}</p>}
        <Input label="Full Name" id="name" type="text" value={name} onChange={e => setName(e.target.value)} required />
        <Input label="Registration Number" id="regNo" type="text" value={regNo} onChange={e => setRegNo(e.target.value)} required />
        <div className="flex flex-col gap-4">
          <Button type="submit">Login / Register</Button>
          <Button type="button" variant="secondary" onClick={onBack}>Back to Home</Button>
        </div>
      </form>
    </div>
  );
};

const StudentDashboardPage = ({ student }: { student: Student }) => (
  <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
    <Card className="md:col-span-2 lg:col-span-3">
        <div className="p-6">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Welcome, {student.name}!</h2>
            <p className="text-gray-600 dark:text-gray-400">Reg No: {student.regNo}</p>
        </div>
    </Card>
    <Card>
      <div className="p-6">
        <h3 className="text-lg font-medium text-gray-800 dark:text-white">Attendance</h3>
        <p className="mt-4 text-5xl font-bold text-indigo-500">{student.attendance}%</p>
      </div>
    </Card>
    <Card>
      <div className="p-6">
        <h3 className="text-lg font-medium text-gray-800 dark:text-white">Pending Assignments</h3>
        <p className="mt-4 text-5xl font-bold text-indigo-500">{student.pendingAssignments}</p>
      </div>
    </Card>
    <Card className="md:col-span-2 lg:col-span-1">
      <div className="p-6">
        <h3 className="text-lg font-medium text-gray-800 dark:text-white">Teachers List</h3>
        <ul className="mt-4 space-y-3">
          {MOCK_TEACHERS.map(teacher => (
            <li key={teacher.id} className="text-gray-600 dark:text-gray-300">
              <span className="font-semibold">{teacher.name}</span> - {teacher.subject}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  </div>
);

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
    <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-gray-800 shadow-lg rounded-xl">
      <div>
        <h2 className="text-center text-3xl font-extrabold text-gray-900 dark:text-white">Admin Login</h2>
      </div>
      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        {error && <p className="text-sm text-red-500 text-center">Invalid credentials</p>}
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

const AdminDashboardPage = ({ students, onToggleBlock, onViewDetails }: { students: Student[], onToggleBlock: (regNo: string) => void, onViewDetails: (student: Student) => void }) => (
  <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <Card className="w-full">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Registered Students</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Reg No</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {students.length === 0 ? (
                <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">No students registered yet.</td>
                </tr>
            ) : students.map((student) => (
              <tr key={student.regNo}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{student.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{student.regNo}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${student.isBlocked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                    {student.isBlocked ? 'Blocked' : 'Active'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end items-center gap-2">
                    <button onClick={() => onViewDetails(student)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300" title="View Details">
                      <EyeIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => onToggleBlock(student.regNo)} className={student.isBlocked ? "text-green-600 hover:text-green-900" : "text-red-600 hover:text-red-900"} title={student.isBlocked ? 'Unblock Student' : 'Block Student'}>
                      {student.isBlocked ? <LockOpenIcon className="w-5 h-5" /> : <LockClosedIcon className="w-5 h-5" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
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

  const handleStudentLogin = useCallback((name: string, regNo: string): string | null => {
    const existingStudent = students.find(s => s.regNo === regNo);
    if (existingStudent) {
      if (existingStudent.isBlocked) {
        return "Your account is blocked. Please contact administration.";
      }
      if (existingStudent.name.toLowerCase() !== name.toLowerCase()) {
        return "Registration number found, but name does not match.";
      }
      setCurrentUser({ ...existingStudent, role: 'student' });
      setPage(Page.StudentDashboard);
      return null;
    } else {
      const newStudent: Student = {
        name,
        regNo,
        attendance: Math.floor(Math.random() * 31) + 70, // 70-100
        pendingAssignments: Math.floor(Math.random() * 11), // 0-10
        isBlocked: false,
      };
      setStudents(prev => [...prev, newStudent]);
      setCurrentUser({ ...newStudent, role: 'student' });
      setPage(Page.StudentDashboard);
      return null;
    }
  }, [students]);

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

  const handleToggleBlock = useCallback((regNo: string) => {
    setStudents(prev =>
      prev.map(s =>
        s.regNo === regNo ? { ...s, isBlocked: !s.isBlocked } : s
      )
    );
  }, []);
  
  const handleViewDetails = (student: Student) => {
    setSelectedStudent(student);
  };
  
  const handleCloseModal = () => {
    setSelectedStudent(null);
  }

  const renderPage = () => {
    switch (page) {
      case Page.StudentLogin:
        return <StudentLoginPage onLogin={handleStudentLogin} onBack={() => setPage(Page.Home)} />;
      case Page.StudentDashboard:
        if (currentUser?.role === 'student') {
          return <StudentDashboardPage student={currentUser} />;
        }
        return null;
      case Page.AdminLogin:
        return <AdminLoginPage onLogin={handleAdminLogin} onBack={() => setPage(Page.Home)} />;
      case Page.AdminDashboard:
        return <AdminDashboardPage students={students} onToggleBlock={handleToggleBlock} onViewDetails={handleViewDetails} />;
      case Page.Home:
      default:
        return <HomePage onSelectRole={setPage} />;
    }
  };

  const mainContentClasses = useMemo(() => {
      const base = "flex-grow flex items-center justify-center";
      if (page === Page.StudentDashboard || page === Page.AdminDashboard) {
          return "flex-grow";
      }
      return base;
  }, [page]);


  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      <Header userRole={currentUser?.role} onLogout={handleLogout} />
      <main className={mainContentClasses}>
        {renderPage()}
      </main>
      <Modal isOpen={!!selectedStudent} onClose={handleCloseModal} title={`Details for ${selectedStudent?.name}`}>
        {selectedStudent && (
          <div className="space-y-4">
            <p><strong>Registration No:</strong> {selectedStudent.regNo}</p>
            <p><strong>Attendance:</strong> {selectedStudent.attendance}%</p>
            <p><strong>Pending Assignments:</strong> {selectedStudent.pendingAssignments}</p>
            <p><strong>Status:</strong> <span className={selectedStudent.isBlocked ? 'text-red-500' : 'text-green-500'}>{selectedStudent.isBlocked ? 'Blocked' : 'Active'}</span></p>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default App;
