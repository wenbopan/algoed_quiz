# Quiz Platform Components Overview

This document summarizes the main React components for the quiz platform, their responsibilities, supported features, and their role in the user journey for both hosts (admins) and users (participants).

---

## 1. Shared Components

### **Header**
- **What:** Top navigation bar with branding, navigation, and user info.
- **Supports:**
  - Branding/logo
  - Navigation links (e.g., Home, Dashboard, Quiz List)
  - User info (optional)
- **Role:**
  - Present on all pages for both hosts and users, provides consistent navigation and context.

### **Timer**
- **What:** Countdown timer for each question or quiz.
- **Supports:**
  - Displays remaining time
  - Triggers timeout events
- **Role:**
  - Keeps users aware of time constraints during quiz-taking.

### **ScoreDisplay**
- **What:** Shows the current score.
- **Supports:**
  - Live score updates
- **Role:**
  - Motivates users and provides feedback on performance.

### **QuestionCard**
- **What:** Renders a single question and its answer choices.
- **Supports:**
  - Displays question text and choices
  - Handles answer selection
  - Shows feedback (correct/incorrect)
- **Role:**
  - Central to the quiz-taking experience for users.

---

## 2. Admin (Host) Components

### **AdminDashboard**
- **What:** Main hub for hosts to manage quizzes.
- **Supports:**
  - List of all quizzes
  - Create new quiz button
  - Edit/delete existing quizzes
- **Role:**
  - Entry point for hosts to manage and monitor quizzes.

### **QuizEditor**
- **What:** Interface to create or edit quiz questions and answers.
- **Supports:**
  - Add/edit/delete questions and choices
  - Set correct answers
- **Role:**
  - Allows hosts to build and update quiz content.

### **QuizPublisher**
- **What:** Controls to publish or unpublish a quiz.
- **Supports:**
  - Publish/unpublish toggle
- **Role:**
  - Makes quizzes available or unavailable to users.

### **LiveQuizController**
- **What:** Controls live quiz sessions.
- **Supports:**
  - Start quiz
  - Advance to next question
  - Monitor real-time participant scores
- **Role:**
  - Enables hosts to run live quiz sessions and control quiz flow in real time.

---

## 3. User (Participant) Components

### **QuizList**
- **What:** Displays available quizzes for users to join.
- **Supports:**
  - List of published quizzes
  - Join/start quiz button
- **Role:**
  - Entry point for users to select and join a quiz.

### **QuizPlayer**
- **What:** Main interface for taking a quiz.
- **Supports:**
  - Shows current question, choices, timer, and score
  - Handles answer submission and feedback
  - Navigates through questions
- **Role:**
  - Core experience for users during quiz participation.

### **QuizResult**
- **What:** Displays final score and results after quiz completion.
- **Supports:**
  - Shows user’s score
  - (Optional) Leaderboard or comparison to others
- **Role:**
  - Provides closure and feedback at the end of the quiz journey.

---

## 4. Component Roles in User Journeys

### **Host (Admin) Journey**
1. **AdminDashboard** → 2. **QuizEditor** (create/edit quiz) → 3. **QuizPublisher** (publish quiz) → 4. **LiveQuizController** (run live session, monitor scores)

### **User (Participant) Journey**
1. **QuizList** (select quiz) → 2. **QuizPlayer** (take quiz) → 3. **QuizResult** (view results)

**Shared components** (Header, Timer, ScoreDisplay, QuestionCard) are used throughout both journeys to provide a consistent and functional experience. 