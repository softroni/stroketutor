# The Studio's Learners page (2026-10-02)

The Learners page (`#/learners`) and its summary on Today, as built in `c4724b8`, shown with the committed sample
(`STUDIO_LEARNERS_SAMPLE=server/fixtures/learners-sample.json`: PostHog's events for Oct 1 and 2, 2026, ids
relabeled). With `POSTHOG_PERSONAL_API_KEY` set, the same page reads PostHog live.

## A day

Six numbers against the day before, the journey of the day's installs (children and 13+ apart), the lessons drawn
most, then every session as the lessons it drew: green-ringed when finished, dashed where they stopped, gold badges
for a kept photo, a tap on a locked lesson and a wish.

<img src="day.png" width="900">

## One session opened

A tap on a row opens it as a timeline in words, each lesson beside its picture.

<img src="day-open.png" width="900">

## A week and a month

One column per day: lessons finished, installs, and the lesson drawn most. A day opens its session list.

<img src="week.png" width="900">

<img src="month.png" width="900">

## On Today

The day's numbers and its most drawn lessons, with "Every session ›" to the page. Here alone, since this Mac has no
`status.json`; on m4-1 it sits under Today's Numbers.

<img src="today.png" width="900">

## Dark, and on a phone

<img src="day-dark.png" width="900">

<img src="phone.png" width="300">
