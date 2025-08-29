import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Clock, Lock, Unlock, TrendingUp, TrendingDown, Info, ChevronDown, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../hooks/use-language';

interface Interval {
  intervalNumber: number;
  start: string;
  end: string;
  points: number;
  label: string;
}

interface Slot {
  slotNumber?: number;
  start: Date | string;
  end: Date | string;
  isActive?: boolean;
  timeRemaining?: number;
  pointsIfCorrect?: number;
  penaltyIfWrong?: number;
  intervals?: Interval[];
}

interface LockStatus {
  isLocked: boolean;
  timeUntilLock: number;
  timeUntilStart: number;
  timeUntilUnlock: number;
  lockStartTime: Date;
  slotStartTime: Date;
}

interface EnhancedSlotDisplayProps {
  duration: string;
  onSlotSelect?: (slot: Slot) => void;
  selectedSlot?: Slot | null;
}

export function EnhancedSlotDisplay({ duration, onSlotSelect, selectedSlot }: EnhancedSlotDisplayProps) {
  const { t } = useLanguage();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [expandedSlots, setExpandedSlots] = useState<Set<number>>(new Set());

  // Update current time every second for live countdowns
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const { data: slots, isLoading, error } = useQuery({
    queryKey: ['slots', duration],
    queryFn: async () => {
      const response = await fetch(`/api/slots/${duration}`);
      if (!response.ok) throw new Error('Failed to fetch slots');
      const data = await response.json();
      console.log('Slots data received:', data);
      console.log('First slot structure:', data[0]);
      return data as Slot[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const toggleSlotExpansion = (slotNumber: number) => {
    setExpandedSlots(prev => {
      const newSet = new Set(prev);
      if (newSet.has(slotNumber)) {
        newSet.delete(slotNumber);
      } else {
        newSet.add(slotNumber);
      }
      return newSet;
    });
  };

  const formatTimeRemaining = (milliseconds: number): string => {
    try {
      console.log('formatTimeRemaining called with:', milliseconds, typeof milliseconds);
      
      if (typeof milliseconds !== 'number' || isNaN(milliseconds)) {
        console.warn('Invalid milliseconds value:', milliseconds);
        return 'Invalid Time';
      }
      
      if (milliseconds <= 0) return '00:00:00';
      
      const seconds = Math.floor(milliseconds / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      
      const result = days > 0 
        ? `${days}d ${hours % 24}h ${minutes % 60}m`
        : hours > 0 
        ? `${hours}h ${minutes % 60}m ${seconds % 60}s`
        : minutes > 0 
        ? `${minutes}m ${seconds % 60}s`
        : `${seconds}s`;
      
      console.log('formatTimeRemaining result:', result);
      return result;
    } catch (error) {
      console.error('Error in formatTimeRemaining:', error, milliseconds);
      return 'Error';
    }
  };

  const formatCESTTime = (date: Date | string): string => {
    try {
      console.log('formatCESTTime called with:', date, typeof date);
      
      if (!date) {
        console.warn('formatCESTTime: date is falsy:', date);
        return 'No Date';
      }
      
      const dateObj = date instanceof Date ? date : new Date(date);
      console.log('dateObj created:', dateObj, 'isValid:', !isNaN(dateObj.getTime()));
      
      // Check if the date is valid
      if (isNaN(dateObj.getTime())) {
        console.warn('formatCESTTime: Invalid date object:', dateObj);
        return 'Invalid Date';
      }
      
      const formatted = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Berlin',
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(dateObj);
      
      console.log('formatCESTTime result:', formatted);
      return formatted;
    } catch (error) {
      console.error('Error formatting date:', error, date);
      return 'Invalid Date';
    }
  };

  const getDurationLabel = (duration: string): string => {
    const labels: Record<string, string> = {
      '1h': '1 Hour',
      '3h': '3 Hours',
      '6h': '6 Hours',
      '24h': '1 Day',
      '48h': '2 Days',
      '1w': '1 Week',
      '1m': '1 Month',
      '3m': '3 Months',
      '6m': '6 Months',
      '1y': '1 Year'
    };
    return labels[duration] || duration;
  };

  const getDurationColor = (duration: string): string => {
    const colors: Record<string, string> = {
      '1h': 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
      '3h': 'bg-green-500/20 text-green-300 border border-green-500/30',
      '6h': 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
      '24h': 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
      '48h': 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
      '1w': 'bg-pink-500/20 text-pink-300 border border-pink-500/30',
      '1m': 'bg-red-500/20 text-red-300 border border-red-500/30',
      '3m': 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
      '6m': 'bg-teal-500/20 text-teal-300 border border-teal-500/30',
      '1y': 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
    };
    return colors[duration] || 'bg-gray-500/20 text-gray-300 border border-gray-500/30';
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-1/3"></div>
            </CardHeader>
            <CardContent>
              <div className="h-20 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <p className="text-red-600 text-center">
            Error loading slots: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!slots || slots.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">No slots available for {duration}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Duration Explanation */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
        <div className="flex items-start space-x-2">
          <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-300">
            <p className="font-medium">How it works:</p>
            <p>Each slot represents a {getDurationLabel(duration).toLowerCase()} time window. The slot is divided into smaller intervals where you can earn points based on your prediction accuracy.</p>
            <p className="mt-1 text-xs">For example, a 1-hour slot might have 4 intervals of 15 minutes each, while a 1-day slot might have 24 intervals of 1 hour each.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Available Slots</h3>
        <Badge className={getDurationColor(duration)}>
          {getDurationLabel(duration)}
        </Badge>
      </div>

            {/* Horizontal Scrollable Slots */}
      <div className="relative">
        {/* Scroll hint */}
        <div className="text-xs text-muted-foreground mb-2 flex items-center justify-center">
          <span>← Scroll to see all available slots →</span>
        </div>
        
        <div className="flex space-x-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          {(() => {
            const validSlots = slots.filter(slot => {
              const isValid = slot.start && slot.end && slot.slotNumber !== undefined;
              return isValid;
            });
            
            return validSlots.map((slot) => {
              // Fix: Ensure proper type comparison for slot selection
              const slotNumber = Number(slot.slotNumber);
              const selectedSlotNumber = selectedSlot ? Number(selectedSlot.slotNumber) : null;
              const isSelected = selectedSlotNumber === slotNumber;
              const isExpanded = expandedSlots.has(slotNumber);
              
              console.log('Slot selection check:', {
                slotNumber,
                selectedSlotNumber,
                isSelected,
                slotType: typeof slotNumber,
                selectedType: typeof selectedSlotNumber,
                originalSlotNumber: slot.slotNumber,
                originalSelectedSlotNumber: selectedSlot?.slotNumber,
                selectedSlotExists: !!selectedSlot,
                selectedSlotFull: selectedSlot
              });
              
              const isLocked = !slot.timeRemaining || slot.timeRemaining <= 0 || (slot.timeRemaining <= 300000);
              
              return (
                <Card 
                  key={slotNumber} 
                  className={`min-w-[280px] max-w-[320px] flex-shrink-0 transition-all duration-200 ${
                    isSelected 
                      ? 'ring-2 ring-primary border-primary' 
                      : 'hover:shadow-md'
                  } ${isLocked ? 'opacity-75' : ''}`}
                >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CardTitle className="text-base">
                      Slot {slot.slotNumber ?? 'Unknown'}
                    </CardTitle>
                    <Badge variant={(slot.isActive ?? false) ? "default" : "secondary"}>
                      {(slot.isActive ?? false) ? "Active" : "Upcoming"}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {isLocked ? (
                      <Badge variant="destructive" className="flex items-center space-x-1">
                        <Lock className="h-3 w-3" />
                        <span>Locked</span>
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="flex items-center space-x-1">
                        <Unlock className="h-3 w-3" />
                        <span>Open</span>
                      </Badge>
                    )}
                    
                    <div className="text-sm text-muted-foreground">
                      {slot.pointsIfCorrect || 0} pts
                    </div>
                  </div>
                </div>
              </CardHeader>

                             <CardContent className="space-y-3">
                 {/* Compact Slot Info */}
                 <div className="space-y-2 text-sm">
                   <div className="bg-muted p-2 rounded">
                     <div className="text-xs text-muted-foreground mb-1">Time Window</div>
                     <div className="font-medium text-xs">
                       {formatCESTTime(slot.start)} - {formatCESTTime(slot.end)}
                     </div>
                   </div>

                                   
                   {slot.timeRemaining && slot.timeRemaining > 0 && (
                     <div className="bg-primary/10 p-2 rounded">
                       <div className="text-xs text-muted-foreground mb-1">
                         {(slot.isActive ?? false) ? "Ends in:" : "Starts in:"}
                       </div>
                       <div className="font-mono font-bold text-primary text-xs">
                         {formatTimeRemaining(slot.timeRemaining)}
                       </div>
                     </div>
                   )}
                 </div>

                                 {/* Collapsible Intervals Section */}
                 {slot.intervals && Array.isArray(slot.intervals) && slot.intervals.length > 0 && (
                   <div className="border rounded-lg">
                     <button
                       onClick={() => toggleSlotExpansion(slotNumber)}
                       className="w-full p-2 flex items-center justify-between hover:bg-muted/50 transition-colors text-xs"
                     >
                       <span className="font-medium">
                         Intervals ({slot.intervals.length})
                       </span>
                       <div className="flex items-center space-x-2">
                         <span className="text-xs text-muted-foreground">
                           {slot.intervals.reduce((sum, int) => sum + (int.points || 0), 0)} pts
                         </span>
                         {isExpanded ? (
                           <ChevronDown className="h-3 w-3" />
                         ) : (
                           <ChevronRight className="h-3 w-3" />
                         )}
                       </div>
                     </button>
                     
                     {isExpanded && (
                       <div className="border-t bg-muted/30 p-2">
                         <div className="text-xs text-muted-foreground mb-2">
                           {slot.intervals.length} intervals:
                         </div>
                         <div className="grid grid-cols-2 gap-1">
                           {slot.intervals.map((interval) => (
                             <div 
                               key={interval.intervalNumber}
                               className="bg-background p-1 rounded text-xs border"
                             >
                               <div className="font-medium text-center text-primary">
                                 {interval.points || 0} pts
                               </div>
                               <div className="text-center text-muted-foreground text-xs">
                                 {interval.label || 'Unknown'}
                               </div>
                             </div>
                           ))}
                         </div>
                       </div>
                     )}
                   </div>
                 )}

                {/* Action Button */}
                <div className="flex justify-center">
                  <Button
                    onClick={() => {
                      console.log('Slot selected:', {
                        slot,
                        slotNumber,
                        selectedSlotNumber,
                        isSelected
                      });
                      // Create a new slot object with consistent slotNumber type
                      const slotToSelect = {
                        ...slot,
                        slotNumber: slotNumber // Use the converted number
                      };
                      onSlotSelect?.(slotToSelect);
                    }}
                    disabled={isLocked}
                    variant={isSelected ? "default" : "outline"}
                    className="w-full text-sm h-8"
                  >
                    {isLocked ? (
                      <>
                        <Lock className="h-3 w-3 mr-1" />
                        Locked
                      </>
                    ) : isSelected ? (
                      <>
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Selected
                      </>
                    ) : (
                      <>
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Select
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        });
      })()}
        </div>
        
        {/* Scroll indicator */}
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none"></div>
      </div>
    </div>
  );
}

