export interface EligibilityResult {
  permissibleDuration: number | null;
  eligibilityStatus: '3 Months Approved' | '3 Months + 3 Months Extension' | 'Not Eligible';
}

export const calculateEligibility = (
  attendance: number,
  spfBand: string | null,
  cdcBand: string | null,
  proposedDuration: number
): EligibilityResult => {
  // STEP 1: Attendance check
  if (attendance < 75) {
    return {
      permissibleDuration: 0,
      eligibilityStatus: 'Not Eligible',
    };
  }

  // If bands are not set yet
  if (!spfBand || !cdcBand) {
    return {
      permissibleDuration: null,
      eligibilityStatus: 'Not Eligible',
    };
  }

  let permissibleDuration = 0;

  // STEP 2: Band logic
  if (spfBand === 'A' && cdcBand === 'A') {
    permissibleDuration = 6;
  } else if ((spfBand === 'A' || spfBand === 'B') && (cdcBand === 'A' || cdcBand === 'B')) {
    permissibleDuration = 6;
  } else if ((spfBand === 'C' || spfBand === 'D') && (cdcBand === 'A' || cdcBand === 'B')) {
    permissibleDuration = 3;
  } else if ((spfBand === 'C' || spfBand === 'D') && (cdcBand === 'C' || cdcBand === 'D')) {
    permissibleDuration = 0;
  }

  if (permissibleDuration === 0) {
    return {
      permissibleDuration: 0,
      eligibilityStatus: 'Not Eligible',
    };
  }

  const approvedDuration = Math.min(proposedDuration, permissibleDuration);

  let eligibilityStatus: '3 Months Approved' | '3 Months + 3 Months Extension' = '3 Months Approved';
  if (approvedDuration > 3) {
    eligibilityStatus = '3 Months + 3 Months Extension';
  }

  return {
    permissibleDuration,
    eligibilityStatus,
  };
};
