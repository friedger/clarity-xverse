;; @name user can delegate
;; @caller wallet_1
(define-public (test-user-can-delegate)
    (begin
        (try! (to-response-uint (contract-call? 'ST000000000000000000002AMW42H.pox-4 allow-contract-caller 
            .pox4-pools none)))
        (try! (contract-call? .pox4-pools delegate-stx
            u1000000
            'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
            none
            none
            {version: 0x01, hashbytes: 0x123456}
            none))
        (ok true)))

(define-public (test-user-cant-delegate-without-allow)
    (begin 
        (try! (to-response-uint (contract-call? 'ST000000000000000000002AMW42H.pox-4 allow-contract-caller 
            .pox4-pools none)))
        (let ((result (contract-call? .pox4-pools delegate-stx
            u1000000
            'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
            none
            none
            {version: 0x01, hashbytes: 0x123456}
            none)))
        (asserts! (is-eq result (err u9)) (match result success (err u99999) error (err error)))
        (ok true))))


(define-read-only (to-response-uint (resp (response bool int)))
    (match resp success (ok success) error (err (to-uint error))))