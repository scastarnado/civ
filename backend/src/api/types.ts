export type GovernanceType = 'community' | 'government';
export type CivilizationRole = 'ruler' | 'councilor' | 'officer' | 'citizen';

export interface AuthenticatedUser {
	id: number;
	username: string;
}
