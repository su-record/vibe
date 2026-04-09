# Discovery Checklist: Mobile App

> iOS/Android/크로스플랫폼 **네이티브 앱**. React Native, Flutter, Swift, Kotlin 등.

## Required

### R1. purpose
**Q**: 이 모바일 앱으로 어떤 문제를 해결하시려 하나요?

### R2. platforms
**Q**: 어떤 플랫폼을 지원하나요?
**힌트**: iOS만 / Android만 / 둘 다 / 웹+앱.
**follow-up**: "우선 개발 플랫폼은?"

### R3. target-users
**Q**: 주요 사용자는 누구이며 언제 앱을 사용하나요?
**힌트**: 사용 맥락(출퇴근, 운동 중, 여가, 업무 등)이 중요.

### R4. core-features
**Q**: 핵심 기능(Must)은 무엇인가요?
**힌트**: 3-7개. MVP 범위로 압축.

### R5. auth-method
**Q**: 인증 방식은?
**힌트**: 소셜 로그인, 애플 로그인(iOS 필수), 전화번호, 게스트 모드, 인증 없음.

### R6. backend-need
**Q**: 백엔드가 필요한가요?
**힌트**: 100% 로컬 / BaaS(Firebase/Supabase) / 자체 백엔드 / 기존 API 사용.

### R7. store-plan
**Q**: 앱스토어 배포 계획이 있나요?
**힌트**: App Store, Play Store, 사내 배포, TestFlight만.

### R8. success-metric
**Q**: 성공 기준은? (DAU, 리텐션, 리뷰 점수, 특정 액션 N회)

## Optional

### O1. offline-mode
**Q**: 오프라인 동작이 필요한가요?
**힌트**: 완전 오프라인 / 일부 기능 / 온라인 필수.

### O2. push-notifications
**Q**: 푸시 알림이 필요한가요?
**힌트**: APNs, FCM, OneSignal.

### O3. native-features
**Q**: 어떤 네이티브 기능을 사용하나요?
**힌트**: 카메라, 위치, 생체인증, HealthKit, 연락처, 블루투스, NFC.

### O4. deep-linking
**Q**: 딥링크/유니버설 링크가 필요한가요?

### O5. in-app-purchase
**Q**: 인앱 결제가 필요한가요?
**힌트**: IAP(구독/소비성), 외부 결제 링크.

### O6. analytics
**Q**: 분석 도구는?
**힌트**: Firebase Analytics, Amplitude, Mixpanel, PostHog.

### O7. crash-reporting
**Q**: 크래시 리포팅은?
**힌트**: Sentry, Crashlytics, Bugsnag.

### O8. accessibility
**Q**: 접근성 요구사항은?
**힌트**: VoiceOver(iOS), TalkBack(Android), Dynamic Type.

### O9. dark-mode
**Q**: 다크 모드 지원이 필요한가요?

### O10. i18n
**Q**: 다국어 지원이 필요한가요?

### O11. device-orientation
**Q**: 지원 디바이스 방향은?
**힌트**: 세로 전용 / 가로 전용 / 둘 다 / 태블릿.

### O12. min-os-version
**Q**: 지원 최소 OS 버전은?

### O13. app-size
**Q**: 앱 용량 제한이 있나요?

### O14. build-distribution
**Q**: 빌드/배포 방식은?
**힌트**: EAS, Fastlane, Xcode Cloud, CI/CD.
