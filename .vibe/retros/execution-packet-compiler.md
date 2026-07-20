# Retrospective: Execution Packet Compiler

- Canonical SPEC과 실행 packet을 분리하면 모델별 최적화와 계약 보존을 동시에 다룰 수 있다.
- hash만 검증하면 packet 본문 변조를 막지 못한다. canonical 재컴파일과 전체 비교가 필요하다.
- requirement selection은 packet 자체가 아니라 호출자의 기대값을 신뢰 기준으로 삼아야 한다.
- split SPEC은 master 제약을 phase packet에 실제 값으로 materialize해야 한다.
- generator·init template·runtime skill을 함께 검증해야 mandatory workflow의 호환성을 보장할 수 있다.
