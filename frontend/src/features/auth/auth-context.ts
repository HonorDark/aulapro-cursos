import { createContext } from "react";
import type { User } from "../../types";

export type AuthValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
};

export const AuthContext = createContext<AuthValue | null>(null);
