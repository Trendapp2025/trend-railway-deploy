import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { UserProfile } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { registerWithEmailAndPassword, sendPasswordReset, loginWithEmailAndPassword, logout as firebaseLogout, onAuthStateChange } from "../lib/firebase-auth";
import { auth } from "../lib/firebase";

// Client-side User type (simplified from schema)
interface User {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  role: 'user' | 'admin';
}

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<void, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<void, Error, RegisterData>;
  verifyEmailMutation: UseMutationResult<{ message: string }, Error, { token: string }>;
  requestPasswordResetMutation: UseMutationResult<{ message: string }, Error, { email: string }>;
  resetPasswordMutation: UseMutationResult<{ message: string }, Error, ResetPasswordData>;
  refreshUserProfile: () => Promise<void>;
};

type LoginData = {
  email: string;
  password: string;
};

type RegisterData = {
  username: string;
  email: string;
  password: string;
};

type ResetPasswordData = {
  token: string;
  password: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  // Firebase authentication state
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Listen to Firebase authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      setIsLoading(true);
      
      if (firebaseUser) {
        // User is signed in
        try {
          // First set basic Firebase user data
          const userData: User = {
            id: firebaseUser.uid,
            username: 'Loading...', // Don't set username from Firebase initially
            email: firebaseUser.email!,
            emailVerified: firebaseUser.emailVerified,
            role: 'user' as const,
          };
          
          setUser(userData);
          
          // Fetch user profile from backend to get the correct username
          try {
            console.log('Fetching user profile from backend...');
            console.log('Firebase UID:', firebaseUser.uid);
            console.log('Firebase email:', firebaseUser.email);
            
            // Use the new endpoint that gets profile by email (no auth required)
            const response = await fetch(`/api/user/profile/email/${encodeURIComponent(firebaseUser.email!)}`);
            
            console.log('Profile response status:', response.status);
            console.log('Profile response headers:', response.headers);
            
            if (response.ok) {
              const profileData = await response.json();
              console.log('Profile data received:', profileData);
              // Update user with correct username from backend
              const updatedUser = {
                ...userData,
                username: profileData.username || 'Unknown User',
                role: profileData.role || userData.role,
              };
              console.log('Updating user with:', updatedUser);
              setUser(updatedUser);
              setProfile(profileData);
            } else {
              console.warn('Profile response not ok:', response.status, response.statusText);
              const errorText = await response.text();
              console.warn('Profile error response:', errorText);
              // Set a fallback username if profile fetch fails
              setUser({
                ...userData,
                username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              });
            }
          } catch (profileError) {
            console.warn('Failed to fetch user profile:', profileError);
            // Set a fallback username if profile fetch fails
            setUser({
              ...userData,
              username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            });
          }
          
          setError(null);
        } catch (error) {
          console.error('Error setting up user:', error);
          setError(error as Error);
        }
      } else {
        // User is signed out
        setUser(null);
        setProfile(null);
        setError(null);
      }
      
      setIsLoading(false);
    });
    
    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Refresh profile when user changes to ensure username is always up to date
  useEffect(() => {
    if (user && !profile) {
      // Fetch user profile from backend to get the correct username
      const fetchProfile = async () => {
        try {
          // Use the new endpoint that gets profile by email (no auth required)
          const response = await fetch(`/api/user/profile/email/${encodeURIComponent(auth.currentUser?.email || '')}`);
          
          if (response.ok) {
            const profileData = await response.json();
            setUser({
              ...user,
              username: profileData.username || user.username,
              role: profileData.role || user.role,
            });
            setProfile(profileData);
          }
        } catch (error) {
          console.warn('Failed to fetch user profile:', error);
        }
      };
      
      fetchProfile();
    }
  }, [user, profile]);
    


  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      try {
        // Use Firebase for login
        await loginWithEmailAndPassword(
          credentials.email, 
          credentials.password
        );
        // Note: User state is automatically updated by Firebase auth listener
      } catch (error: any) {
        console.error('Firebase login error:', error);
        throw new Error(error.message || 'Login failed');
      }
    },
    onSuccess: () => {
      toast({
        title: "Login successful",
        description: "Welcome back!",
      });
      // Note: User state is automatically updated by Firebase auth listener
      // Redirect to home page after successful login
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterData) => {
      try {
        // Use Firebase for registration
        await registerWithEmailAndPassword(
          credentials.email, 
          credentials.password, 
          credentials.username
        );
        // Note: User state is automatically updated by Firebase auth listener
      } catch (error: any) {
        console.error('Firebase registration error:', error);
        throw new Error(error.message || 'Registration failed');
      }
    },
    onSuccess: () => {
      toast({
        title: "Registration successful",
        description: "Welcome! Please check your email to verify your account.",
      });
      
      // Note: Firebase handles email verification automatically
      // Users will receive a verification email from Firebase
      // User state is automatically updated by Firebase auth listener
      // Redirect to home page after successful registration
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyEmailMutation = useMutation({
    mutationFn: async ({ token }: { token: string }) => {
      const res = await apiRequest("POST", "/api/auth/verify-email", { token });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Email verification failed');
      }
      return await res.json();
    },
    onSuccess: (data: { message: string }) => {
      toast({
        title: "Email verified",
        description: data.message,
      });
      // Refresh user data to update emailVerified status
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Email verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const requestPasswordResetMutation = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      try {
        // Use Firebase for password reset
        await sendPasswordReset(email);
        return { message: 'Password reset email sent successfully. Please check your inbox.' };
      } catch (error: any) {
        console.error('Firebase password reset error:', error);
        throw new Error(error.message || 'Password reset request failed');
      }
    },
    onSuccess: (data: { message: string }) => {
      toast({
        title: "Password reset requested",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Password reset request failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordData) => {
      const res = await apiRequest("POST", "/api/auth/reset-password", data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Password reset failed');
      }
      return await res.json();
    },
    onSuccess: (data: { message: string }) => {
      toast({
        title: "Password reset successful",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Password reset failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Function to refresh user profile
  const refreshUserProfile = async () => {
    if (user) {
      try {
        // Use the new endpoint that gets profile by email (no auth required)
        const response = await fetch(`/api/user/profile/email/${encodeURIComponent(auth.currentUser?.email || '')}`);
        
        if (response.ok) {
          const profileData = await response.json();
          setUser({
            ...user,
            username: profileData.username || user.username,
            role: profileData.role || user.role,
          });
          setProfile(profileData);
        }
      } catch (error) {
        console.warn('Failed to refresh user profile:', error);
      }
    }
  };

  const logoutMutation = useMutation({
    mutationFn: async () => {
      try {
        // Use Firebase for logout
        await firebaseLogout();
        // Clear all query cache
        queryClient.clear();
      } catch (error: any) {
        console.error('Firebase logout error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user/profile"], null);
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        profile: profile ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        verifyEmailMutation,
        requestPasswordResetMutation,
        resetPasswordMutation,
        refreshUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
