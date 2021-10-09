# banano-side-scroller

Directions on using the captcha.

1.  From your server, for each user that will get a captcha, register a new site key by doing a HTTP POST or GET to <https://runner.coranos.cc/bm-captcha-register>

    Example CURL:

        curl https://runner.coranos.cc/bm-captcha-register

    You will get a response like this:

        {"secretKey":"34b977bfd5852ad9e0a17ed2fbff9ad58fe1489f117cceb5e7f1c0bf4fe6625d"}

    save the secret key on your server, and do not send it to the client.

    The secret key does not currently expire, but is not persisted, so it will expire on server reboot.

2.  from your server, for each captcha, do a HTTP POST to <https://runner.coranos.cc/bm-captcha-request> with the following request:

        {"secretKey":"34b977bfd5852ad9e0a17ed2fbff9ad58fe1489f117cceb5e7f1c0bf4fe6625d"}

    Example CURL

        curl https://runner.coranos.cc/bm-captcha-request -X POST -H 'Content-Type: application/json' -H 'Accept:application/json' --data '{"secretKey":"34b977bfd5852ad9e0a17ed2fbff9ad58fe1489f117cceb5e7f1c0bf4fe6625d"}'

    You will get a response like this:

        {"success":true,"images":{"1":"data:image/png;charset=utf-8;base64,","2":"data:image/png;charset=utf-8;base64,","3":"data:image/png;charset=utf-8;base64,","4":"data:image/png;charset=utf-8;base64,","5":"data:image/png;charset=utf-8;base64,","6":"data:image/png;charset=utf-8;base64,"}}

3.  display the images in an array of img by setting the src to the data string:

        const keys = [...Object.keys(json.images)];
        keys.forEach((imageIx) => {
          const selector = '#bm_captcha_image_' + imageIx;
          const captchaImageElt = document.querySelector(selector);
          const data = json.images[imageIx];
          captchaImageElt.setAttribute('src', data);
        });

4.  calculate which answer was clicked. There are six images, 150 pixels wide, so the normal formula would be

        const request = {};
        request.secretKey = bmcaptcha.secretKey;
        request.answer = event.target.getAttribute('data_answer');

5.  from your server, to validate the captcha, do a HTTP POST to <https://runner.coranos.cc/bm-captcha/bm-captcha-verify> with the following request:

        {"secretKey":"34b977bfd5852ad9e0a17ed2fbff9ad58fe1489f117cceb5e7f1c0bf4fe6625d", "answer":1}

    Example CURL

        curl https://runner.coranos.cc/bm-captcha-verify -X POST -H 'Content-Type: application/json' -H 'Accept:application/json' --data '{"secretKey":"34b977bfd5852ad9e0a17ed2fbff9ad58fe1489f117cceb5e7f1c0bf4fe6625d","answer":1}'

    You will get a response like this (date is in ISO 8601 format):

        {"success":true,"challenge_ts": "2011-10-05T14:48:00.000Z","message":"you answered 1 and the correct one was 1"}
