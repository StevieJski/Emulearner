/**
 * Challenge Registry
 *
 * Central registry for looking up challenges by ID or lesson number.
 */

import { Challenge, ChallengeMeta, getChallengeMeta } from './types';
import { GameId } from '../data/types';

/**
 * Challenge registry - stores all registered challenges
 */
const challenges: Map<string, Challenge> = new Map();

/**
 * Register a challenge
 */
export function registerChallenge(challenge: Challenge): void {
  if (challenges.has(challenge.id)) {
    console.warn(`Challenge "${challenge.id}" is already registered. Overwriting.`);
  }
  challenges.set(challenge.id, challenge);
}

/**
 * Register multiple challenges at once
 */
export function registerChallenges(challengeList: Challenge[]): void {
  for (const challenge of challengeList) {
    registerChallenge(challenge);
  }
}

/**
 * Get a challenge by ID
 */
export function getChallenge(id: string): Challenge | undefined {
  return challenges.get(id);
}

/**
 * Get a challenge by lesson number
 */
export function getChallengeByLesson(lessonNumber: number): Challenge | undefined {
  for (const challenge of challenges.values()) {
    if (challenge.lessonNumber === lessonNumber) {
      return challenge;
    }
  }
  return undefined;
}

/**
 * Get all challenges
 */
export function getAllChallenges(): Challenge[] {
  return Array.from(challenges.values());
}

/**
 * Get all challenges sorted by lesson number
 */
export function getChallengesSorted(): Challenge[] {
  return getAllChallenges().sort((a, b) => a.lessonNumber - b.lessonNumber);
}

/**
 * Get challenge metadata for all challenges
 */
export function getAllChallengeMeta(): ChallengeMeta[] {
  return getChallengesSorted().map(getChallengeMeta);
}

/**
 * Get challenges for a specific game
 */
export function getChallengesForGame(gameId: GameId): Challenge[] {
  return getChallengesSorted().filter(c => c.game === gameId);
}

/**
 * Check if a challenge exists
 */
export function hasChallenge(id: string): boolean {
  return challenges.has(id);
}

/**
 * Get the next challenge after the given one
 */
export function getNextChallenge(currentId: string): Challenge | undefined {
  const current = challenges.get(currentId);
  if (!current) return undefined;

  const sorted = getChallengesSorted();
  const currentIndex = sorted.findIndex(c => c.id === currentId);

  if (currentIndex >= 0 && currentIndex < sorted.length - 1) {
    return sorted[currentIndex + 1];
  }
  return undefined;
}

/**
 * Get the previous challenge before the given one
 */
export function getPreviousChallenge(currentId: string): Challenge | undefined {
  const current = challenges.get(currentId);
  if (!current) return undefined;

  const sorted = getChallengesSorted();
  const currentIndex = sorted.findIndex(c => c.id === currentId);

  if (currentIndex > 0) {
    return sorted[currentIndex - 1];
  }
  return undefined;
}

/**
 * Clear all registered challenges (useful for testing)
 */
export function clearChallenges(): void {
  challenges.clear();
}

/**
 * Get total number of challenges
 */
export function getChallengeCount(): number {
  return challenges.size;
}
