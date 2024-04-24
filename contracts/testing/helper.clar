;; Helper contract mainly to wrap read-only function in public functions
;; that can be used with "clarinet integrate".
;; Currently, it is not possible to use read-only functions in deployment plans.

(define-public (get-user-data (user principal))
  (ok (print (contract-call? .pox4-pools get-user-data user))))

(define-public (get-status (pool principal) (user principal) (reward-cycle uint))
  (ok (print (contract-call? .pox4-pools get-status pool user reward-cycle))))

(define-public (get-stx-account (user principal))
  (ok (print (contract-call? .pox4-pools get-stx-account user))))

(define-public (get-reward-set (reward-cycle uint))
  (ok (print (contract-call? .pox4-self-service-v3 get-reward-set reward-cycle))))

;; call wrapper contract from a contract
;; requires allowance
(define-public (delegate-stx (amount-ustx uint))
  (contract-call? .pox4-self-service-v3 delegate-stx amount-ustx))
