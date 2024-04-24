(define-constant err-no-last-commit -1)
(define-constant err-no-reward-set-index -2)
(define-constant err-no-id-header-hash -3)
(define-constant err-no-reward-set -4)

(define-read-only (amount-locked-at-cycle (user principal) (cycle-id uint))
    (let (
        (last-commit (unwrap! (contract-call? 'SP21YTSM60CAY6D011EZVEVNKXVW8FVZE198XEFFP.pox-fast-pool-v2 get-last-aggregation cycle-id) err-no-last-commit))
        (id-header-hash (unwrap! (get-block-info? id-header-hash last-commit) err-no-id-header-hash)))
        (to-int (get-user-stacked user id-header-hash))))

(define-read-only (get-user-stacked (user principal) (id-header-hash (buff 32)))
  (get locked (at-block id-header-hash (stx-account user))))

(define-read-only (get-total-stacked (cycle-id uint))
  (let (
      (reward-set-index (unwrap! (contract-call? 'SP21YTSM60CAY6D011EZVEVNKXVW8FVZE198XEFFP.pox-fast-pool-v2 get-pox-addr-index cycle-id) err-no-reward-set-index)))
    (to-int (get total-ustx (unwrap! (contract-call? 'ST000000000000000000002AMW42H.pox-3 get-reward-set-pox-address cycle-id reward-set-index) err-no-reward-set)))))
