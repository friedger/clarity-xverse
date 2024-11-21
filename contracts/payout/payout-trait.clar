(define-trait payout-trait
    ((send-many ((list 200 { to: principal, ustx: uint })) (response bool uint))))