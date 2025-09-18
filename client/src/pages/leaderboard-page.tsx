import { useState, useEffect } from "react";
import { buildApiUrl } from '@/lib/api-config';
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "wouter";
import AppHeader from "@/components/app-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, Trophy, Medal, User2, Star, Calendar, Award, Shield, TrendingUp, TrendingDown, BarChart3, Filter, Crown, Users, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { MonthlyLeaderboard, UserBadge } from "@shared/schema";
import { MonthCountdown } from "@/components/month-countdown";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { API_ENDPOINTS } from "@/lib/api-config";
export default function LeaderboardPage() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [includeAdmins, setIncludeAdmins] = useState<boolean>(true);
  
  // Set default includeAdmins based on user role
  useEffect(() => {
    if (user) {
      // For admins, default to showing all users (including admins)
      // For regular users, default to showing all users (including admins)
      setIncludeAdmins(true);
    }
  }, [user]);
  
  // Generate available months for the selector (last 12 months)
  const getAvailableMonths = () => {
    const months = [];
    const now = new Date();
    console.log('Current date:', now.toISOString(), 'Month:', now.getMonth(), 'Year:', now.getFullYear());
    
    // Generate months going backwards from current month
    for (let i = 0; i < 12; i++) {
      const year = now.getFullYear();
      const month = now.getMonth() - i;
      
      // Handle year rollover
      const actualYear = month < 0 ? year - 1 : year;
      const actualMonth = month < 0 ? month + 12 : month;
      
      // Create month string in YYYY-MM format
      const monthYear = `${actualYear}-${String(actualMonth + 1).padStart(2, '0')}`;
      
      // Create label using the actual year and month
      const date = new Date(actualYear, actualMonth, 1);
      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      months.push({ value: monthYear, label });
      console.log(`Generated month ${i}: ${monthYear} -> ${label} (year: ${actualYear}, month: ${actualMonth})`);
    }
    
    console.log('All generated months:', months);
    
    // Debug: Check if September 2025 is in the list
    const september2025 = months.find(m => m.label === 'September 2025');
    console.log('September 2025 found:', september2025);
    
    return months;
  };
  
  // Get current month in YYYY-MM format
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  // Fetch leaderboard data based on selected month
  const { data: leaderboardData, isLoading } = useQuery<{
    month: string; includeAdmins: boolean; data: Array<MonthlyLeaderboard & { isAdmin?: boolean; badges: string[] }>; total: number; timestamp: string; timezone: string;
  }>({
    queryKey: ["/api/leaderboard", selectedMonth, includeAdmins],
    queryFn: async () => {
      let endpoint = "/api/leaderboard";
      let params = `includeAdmins=${includeAdmins}`;
      
      if (selectedMonth === "current") {
        endpoint = "/api/leaderboard/current";
      } else if (selectedMonth === "" || selectedMonth === "previous") {
        params = `month=previous&${params}`;
      } else {
        params = `month=${selectedMonth}&${params}`;
      }
      
      const response = await fetch(buildApiUrl(`${endpoint}?${params}`));
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard data');
      }
      const data = await response.json();
      console.log('Leaderboard data for month:', selectedMonth, 'Data:', data);
      console.log('Data array length:', data.data?.length);
      console.log('Data array content:', data.data);
      console.log('Backend returned month:', data.month, 'Requested month:', selectedMonth);
      console.log('Include admins:', includeAdmins);
      console.log('Data summary:', {
        month: data.month,
        total: data.total,
        dataLength: data.data?.length,
        includeAdmins: data.includeAdmins,
        firstEntry: data.data?.[0],
        allUsernames: data.data?.map(entry => entry.username)
      });
      return data;
    },
  });

  // Fetch user's current month stats
  const { data: userStats } = useQuery<{
    currentRank: number;
    monthlyScore: number;
    totalPredictions: number;
    accuracyPercentage: number;
    isAdmin: boolean;
  }>({
    queryKey: ["/api/leaderboard/user"],
    enabled: !!user,
  });

  // Fetch leaderboard stats
  const { data: leaderboardStats } = useQuery<{
    currentMonth: { participants: number; monthYear: string };
    previousMonth: { participants: number; monthYear: string };
  }>({
    queryKey: ["/api/leaderboard/stats"],
  });
  
  // If user is not logged in, redirect to login page
  if (!user) {
    return <Redirect to="/auth" />;
  }

  const getRankBadge = (rank: number) => {
    if (rank >= 1 && rank <= 4) {
      const colors = {
        1: "text-yellow-500", // Gold
        2: "text-gray-400", // Silver
        3: "text-amber-600", // Bronze
        4: "text-blue-500", // 4th place
      };
      
      const icons = {
        1: "🥇",
        2: "🥈", 
        3: "🥉",
        4: "🎖️",
      };
      
      return (
        <div className="flex items-center">
          <span className="text-2xl mr-2">{icons[rank as keyof typeof icons]}</span>
          <span className={`font-bold ${colors[rank as keyof typeof colors]}`}>#{rank}</span>
        </div>
      );
    }
    
    return <span className="text-sm font-medium">#{rank}</span>;
  };

  const getMonthLabel = (monthYear: string) => {
    const [year, month] = monthYear.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getAccuracyPercentage = (correct: number, total: number) => {
    if (total === 0) return 0;
    return (correct / total) * 100;
  };

  const formatTimestamp = (timestamp: string, timezone: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-center mb-2">🏆 Leaderboard</h1>
          <p className="text-center text-muted-foreground">
            Compete with traders worldwide and climb the ranks
          </p>
        </div>

        {/* Month Countdown */}
        <div className="mb-6">
          <MonthCountdown />
        </div>

        {/* Admin Filter Toggle - Only visible to admins */}
        {user?.role === "admin" && (
          <div className="mb-6 flex items-center justify-center space-x-2">
            <Switch
              id="include-admins"
              checked={includeAdmins}
              onCheckedChange={setIncludeAdmins}
            />
            <Label htmlFor="include-admins" className="text-sm">
              {includeAdmins ? 'Include Admins' : 'Exclude Admins'}
            </Label>
            <Badge variant="outline" className="ml-2">
              {includeAdmins ? 'All Users' : 'Regular Users Only'}
            </Badge>
          </div>
        )}

        {/* Month Selection */}
        <div className="mb-6 flex justify-center">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            {/* Month Selector */}
            <div className="flex items-center gap-2">
              <Label htmlFor="month-selector" className="text-sm font-medium">
                Select Month:
              </Label>
              <Select
                value={selectedMonth}
                onValueChange={(value) => {
                  console.log('Month selected:', value);
                  setSelectedMonth(value);
                }}
              >
                <SelectTrigger id="month-selector" className="w-48">
                  <SelectValue placeholder="Choose a month" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableMonths().map((month) => {
                    console.log('Rendering SelectItem:', month.value, '->', month.label);
                    return (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            
            {/* Quick Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant={selectedMonth === "" ? "default" : "outline"}
                onClick={() => setSelectedMonth("")}
                className="flex items-center gap-2"
              >
                <Trophy className="h-4 w-4" />
                Previous Month
              </Button>
              <Button
                variant={selectedMonth === "current" ? "default" : "outline"}
                onClick={() => setSelectedMonth("current")}
                className="flex items-center gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                Current Month
              </Button>
            </div>
          </div>
        </div>

        {/* Leaderboard Stats */}
        {leaderboardStats && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Current Month Participants
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{leaderboardStats.currentMonth?.participants || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {leaderboardStats.currentMonth?.monthYear || 'Current Month'}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  Previous Month Participants
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{leaderboardStats.previousMonth?.participants || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {leaderboardStats.previousMonth?.monthYear || 'Previous Month'}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* User Stats */}
        {userStats && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User2 className="h-5 w-5" />
                Your Current Month Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{userStats.currentRank || 'Unranked'}</div>
                  <div className="text-xs text-muted-foreground">Current Rank</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{userStats.monthlyScore || 0}</div>
                  <div className="text-xs text-muted-foreground">Monthly Score</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{userStats.totalPredictions || 0}</div>
                  <div className="text-xs text-muted-foreground">Total Predictions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {userStats.accuracyPercentage ? userStats.accuracyPercentage.toFixed(1) : 0}%
                  </div>
                  <div className="text-xs text-muted-foreground">Accuracy</div>
                </div>
              </div>
              {userStats.isAdmin && (
                <div className="mt-3 flex justify-center">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Crown className="h-3 w-3" />
                    Admin User
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Leaderboard Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {selectedMonth === "current" ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <Trophy className="h-5 w-5" />
              )}
              {selectedMonth === "" ? "Previous Month" : selectedMonth === "current" ? "Current Month" : getMonthLabel(selectedMonth)} Leaderboard
            </CardTitle>
            <CardDescription>
              {leaderboardData && (
                <div className="flex items-center justify-between">
                  <span>
                    {selectedMonth === "current" ? "Live scores updated in real-time" : `Top ${leaderboardData.total} participants`}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Timezone: {leaderboardData.timezone || 'Europe/Berlin'}</span>
                    {leaderboardData.timestamp && (
                      <span>Updated: {formatTimestamp(leaderboardData.timestamp, leaderboardData.timezone)}</span>
                    )}
                  </div>
                </div>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-4 w-8" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : (() => {
              const hasData = leaderboardData?.data && leaderboardData.data.length > 0;
              
              console.log('Leaderboard display check:', {
                hasData,
                dataLength: leaderboardData?.data?.length,
                selectedMonth,
                returnedMonth: leaderboardData?.month,
                includeAdmins: leaderboardData?.includeAdmins,
                allUsernames: leaderboardData?.data?.map(entry => entry.username)
              });
              
              // Simplified logic: show data if it exists
              return hasData;
            })() ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Predictions</TableHead>
                    <TableHead>Accuracy</TableHead>
                    <TableHead>Badges</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboardData.data.map((entry) => (
                    <TableRow key={entry.userId}>
                      <TableCell>{getRankBadge(entry.rank)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link 
                            href={`/user/${entry.username}`}
                            className="font-medium text-primary hover:text-primary/80 hover:underline cursor-pointer"
                          >
                            {entry.username}
                          </Link>
                          {entry.isAdmin && (
                            <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                              <Crown className="h-3 w-3" />
                              Admin
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{entry.totalScore}</TableCell>
                      <TableCell>{entry.totalPredictions}</TableCell>
                      <TableCell>{entry.accuracyPercentage ? parseFloat(entry.accuracyPercentage.toString()).toFixed(1) : '0.0'}%</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {entry.badges && entry.badges.length > 0 ? (
                            entry.badges.map((badge, index) => (
                              <Badge key={index} variant="outline" className="text-xs flex items-center gap-1">
                                {badge === '1st_place' && '🥇'}
                                {badge === '2nd_place' && '🥈'}
                                {badge === '3rd_place' && '🥉'}
                                {badge === '4th_place' && '🎖️'}
                                {badge === 'starter' && '⭐'}
                                {badge.startsWith('streak') && '🔥'}
                                {badge.startsWith('accuracy') && '🎯'}
                                {badge.startsWith('volume') && '📊'}
                                {badge}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground">No badges</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <div className="mb-4">
                  <strong>No leaderboard data available for {selectedMonth === "" ? "Previous Month" : selectedMonth === "current" ? "Current Month" : getMonthLabel(selectedMonth)}</strong>
                </div>
                <div className="text-sm">
                  <p>This could be because:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>No users made predictions in this month</li>
                    <li>The month hasn't ended yet (for previous month data)</li>
                    <li>This month is in the future</li>
                    <li>There's an issue with data fetching</li>
                  </ul>
                </div>
                <div className="mt-4 flex gap-2 justify-center">
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedMonth("")}
                  >
                    View Previous Month
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedMonth("current")}
                  >
                    View Current Month
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}