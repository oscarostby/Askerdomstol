
export enum Role {
  JUDGE = 'JUDGE',
  LAWYER = 'LAWYER',
  JURY = 'JURY', // Public
  SPECTATOR = 'SPECTATOR' // Big Screen
}

export enum CaseStatus {
  IDLE = 'IDLE',
  VOTING = 'VOTING',
  GUILTY = 'GUILTY',
  NOT_GUILTY = 'NOT_GUILTY',
  DISMISSED = 'DISMISSED'
}

export interface User {
  uid: string;
  name: string;
  role: Role;
  joinedAt: number;
}

export interface Vote {
  uid: string;
  verdict: 'YES' | 'NO';
  timestamp: number;
}

export interface Case {
  id: string;
  defendantName: string;
  defendantUid?: string; // If they are online
  title: string;
  description: string;
  amount: number;
  status: CaseStatus;
  createdAt: number;
  votes?: Record<string, Vote>;
  // Remote Control State
  focusMode: 'OVERVIEW' | 'DEFENDANT' | 'EVIDENCE'; 
  speaker: 'JUDGE' | 'DEFENSE' | 'WITNESS'; // Who has the floor
}

export interface Session {
  pin: string;
  createdAt: number;
  isActive: boolean;
  activeCaseId?: string;
  protests?: Record<string, number>; // uid -> timestamp
}

// Global DB Structure
export interface DatabaseSchema {
  sessions: Record<string, Session>;
  cases: Record<string, Case>; // Nested under session ID in practice
  users: Record<string, User>; // Nested under session ID in practice
}
