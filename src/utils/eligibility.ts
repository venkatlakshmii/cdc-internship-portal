export interface EligibilityResult {
  permissibleDuration: number | null;
  eligibilityStatus: '3 Months Approved' | '3 Months + 3 Months Extension' | 'Conditionally Approved' | 'Not Eligible';
}

export const calculateEligibility = (
  attendance: number,
  spfBand: string | null,
  cdcBand: string | null,
  proposedDuration: number,
  yearSem: string
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
  const isSpfAB = spfBand === 'A' || spfBand === 'B';
  const isCdcAB = cdcBand === 'A' || cdcBand === 'B';
  const isSpfCD = spfBand === 'C' || spfBand === 'D';
  const isCdcCD = cdcBand === 'C' || cdcBand === 'D';

  let requiresApproval = false;

  if (isSpfAB && isCdcAB) {
    permissibleDuration = 6;
  } else if (isSpfAB && isCdcCD) {
    permissibleDuration = 6;
    requiresApproval = true;
  } else if (isSpfCD && isCdcAB) {
    permissibleDuration = 3;
    requiresApproval = true;
  } else if (isSpfCD && isCdcCD) {
    permissibleDuration = 0;
  }

  if (permissibleDuration === 0) {
    return {
      permissibleDuration: 0,
      eligibilityStatus: 'Not Eligible',
    };
  }

  // STEP 3: Year-based limits
  const is2ndYear = yearSem.includes('2nd Year');
  const is3rdYear2ndSem = yearSem === '3rd Year – 2nd Sem';
  
  if (is2ndYear) {
    permissibleDuration = Math.min(permissibleDuration, 1); // Max 4 weeks (1 month)
  } else if (is3rdYear2ndSem) {
    permissibleDuration = Math.min(permissibleDuration, 3); // Max 3 months
  }

  const approvedDuration = Math.min(proposedDuration, permissibleDuration);

  // STEP 4: Status determination
  let eligibilityStatus: '3 Months Approved' | '3 Months + 3 Months Extension' | 'Conditionally Approved' | 'Not Eligible' = '3 Months Approved';
  if (requiresApproval) {
    eligibilityStatus = 'Conditionally Approved';
  } else {
    if (approvedDuration > 3) {
      eligibilityStatus = '3 Months + 3 Months Extension';
    } else {
      eligibilityStatus = '3 Months Approved';
    }
  }

  return {
    permissibleDuration,
    eligibilityStatus,
  };
};
