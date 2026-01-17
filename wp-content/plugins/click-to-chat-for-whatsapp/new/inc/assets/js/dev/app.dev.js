// Click to Chat
(function ($) {

    // ready
    $(function () {

        // variables
        var url = window.location.href;
        var post_title = (typeof document.title !== "undefined") ? document.title : '';
        // is_mobile yes/no,  desktop > 1024 
        var is_mobile = (typeof screen.width !== "undefined" && screen.width > 1024) ? "no" : "yes";
        var no_num = '';

        var ht_ctc_storage = {};

        if (localStorage.getItem('ht_ctc_storage')) {
            ht_ctc_storage = localStorage.getItem('ht_ctc_storage');
            ht_ctc_storage = JSON.parse(ht_ctc_storage);
        }

        // get items from ht_ctc_storage
        function ctc_getItem(item) {
            return (ht_ctc_storage[item]) ? ht_ctc_storage[item] : false;
        }

        // set items to ht_ctc_storage storage
        function ctc_setItem(name, value) {
            ht_ctc_storage[name] = value;
            var newValues = JSON.stringify(ht_ctc_storage);
            localStorage.setItem('ht_ctc_storage', newValues);
        }

        var ctc = '';
        if (typeof ht_ctc_chat_var !== "undefined") {
            ctc = ht_ctc_chat_var;
            chat_data();
            start();
        } else {
            try {
                if (document.querySelector('.ht_ctc_chat_data')) {
                    var settings = $('.ht_ctc_chat_data').attr('data-settings');
                    ctc = JSON.parse(settings);
                }
            } catch (e) {
                ctc = {};
            }
            chat_data();
            start();
        }

        function chat_data() {

            // if no num
            var chat_data = document.querySelector('.ht_ctc_chat_data');

            if (chat_data) {
                no_num = $(".ht_ctc_chat_data").attr('data-no_number');
                // remove the element
                chat_data.remove();
            }

        }

        // start
        function start() {

            console.log(ctc);
            document.dispatchEvent(
                new CustomEvent("ht_ctc_event_settings", { detail: { ctc } })
            );

            // fixed position
            ht_ctc();

            // shortcode
            shortcode();

            // custom element
            custom_link();

        }






        // fixed position
        function ht_ctc() {
            console.log('ht_ctc');
            var ht_ctc_chat = document.querySelector('.ht-ctc-chat');
            if (ht_ctc_chat) {

                document.dispatchEvent(
                    new CustomEvent("ht_ctc_event_chat")
                );

                // display
                display_settings(ht_ctc_chat);

                // click
                ht_ctc_chat.addEventListener('click', function () {
                    // ht_ctc_chat_greetings_box (ht_ctc_chat_greetings_box_link) is not exists..

                    if (!$('.ht_ctc_chat_greetings_box').length) {
                        console.log('no greetings dialog');
                        // link
                        ht_ctc_link(ht_ctc_chat);
                    }
                });

                // greetings dialog settings..
                greetings();

                // greetings link click..
                $(document).on('click', '.ht_ctc_chat_greetings_box_link', function (e) {
                    console.log('ht_ctc_chat_greetings_box_link');
                    e.preventDefault();

                    // optin
                    if (document.querySelector('#ctc_opt')) {
                        // if (ctc_getItem('g_optin')) {
                        //     $('#ctc_opt').prop('checked', true);
                        // }
                        if ($('#ctc_opt').is(':checked') || ctc_getItem('g_optin')) {
                            ht_ctc_link(ht_ctc_chat);
                        } else {
                            $('.ctc_opt_in').show(400).fadeOut('1').fadeIn('1');
                        }
                    } else {
                        ht_ctc_link(ht_ctc_chat);
                    }

                    document.dispatchEvent(
                        new CustomEvent("ht_ctc_event_greetings")
                    );
                });

                // optin - checkbox on change
                if (document.querySelector('#ctc_opt')) {
                    $("#ctc_opt").on("change", function (e) {
                        if ($('#ctc_opt').is(':checked')) {
                            $('.ctc_opt_in').hide(100);
                            ctc_setItem('g_optin', 'y');
                            setTimeout(() => {
                                ht_ctc_link(ht_ctc_chat);
                            }, 500);
                        }
                    });
                }

            }

        }


        /**
         * greetings dialog
         */
        function greetings() {

            if ($('.ht_ctc_chat_greetings_box').length) {

                $(document).on('click', '.ht_ctc_chat_style', function (e) {
                    // ctc_greetings_opened / ctc_greetings_closed
                    if ($('.ht_ctc_chat_greetings_box').hasClass('ctc_greetings_opened')) {
                        greetings_close('user_closed');
                    } else {
                        greetings_open('user_opened');
                    }
                });

            }

            // close btn - greetings dialog
            $(document).on('click', '.ctc_greetings_close_btn', function (e) {
                greetings_close('user_closed');
            });

        }

        function greetings_display() {

            if ($('.ht_ctc_chat_greetings_box').length) {

                // Display greetings - device based
                if (ctc.g_device) {
                    if (is_mobile !== 'yes' && 'mobile' == ctc.g_device) {
                        // in desktop: mobile only
                        $('.ht_ctc_chat_greetings_box').remove();
                        return;
                    } else if (is_mobile == 'yes' && 'desktop' == ctc.g_device) {
                        // in mobile: desktop only
                        $('.ht_ctc_chat_greetings_box').remove();
                        return;
                    }
                }

                document.dispatchEvent(
                    new CustomEvent("ht_ctc_event_after_chat_displayed", { detail: { ctc, greetings_open, greetings_close } })
                );

                if (ctc.g_init && 'open' == ctc.g_init && 'user_closed' !== ctc_getItem('g_user_action')) {
                    greetings_open('init');
                }


                $(document).on('click', '.ctc_greetings, #ctc_greetings', function (e) {
                    console.log('greetings open triggered');
                    greetings_close('element');
                    greetings_open('element');
                });


            }

        }

        /**
         * ht_ctc_chat_greetings_box_user_action - this is needed for initial close or open.. if user closed.. then no auto open initially
         * 
         */
        function greetings_open(message = 'open') {
            console.log('open');
            $('.ctc_cta_stick').remove();
            $('.ht_ctc_chat_greetings_box').show(70);
            $('.ht_ctc_chat_greetings_box').addClass('ctc_greetings_opened').removeClass('ctc_greetings_closed');
            ctc_setItem('g_action', message);
            if ('user_opened' == message) {
                ctc_setItem('g_user_action', message);
            }
        }

        function greetings_close(message = 'close') {
            console.log('close');
            $('.ht_ctc_chat_greetings_box').hide(70);
            $('.ht_ctc_chat_greetings_box').addClass('ctc_greetings_closed').removeClass('ctc_greetings_opened');
            ctc_setItem('g_action', message);
            if ('user_closed' == message) {
                ctc_setItem('g_user_action', message);
            }
        }

        // display settings - Fixed position style
        function display_settings(ht_ctc_chat) {

            if ('yes' == ctc.schedule) {
                console.log('scheduled');
                document.dispatchEvent(
                    new CustomEvent("ht_ctc_event_display", { detail: { ctc, display_chat, ht_ctc_chat } })
                );
            } else {
                console.log('display directly');
                display_chat(ht_ctc_chat);
            }

        }

        // display based on device
        function display_chat(p) {

            if (is_mobile == 'yes') {
                if ('show' == ctc.dis_m) {

                    // remove desktop style
                    var rm = document.querySelector('.ht_ctc_desktop_chat');
                    (rm) ? rm.remove() : '';

                    p.style.cssText = ctc.pos_m + ctc.css;
                    display(p)
                }
            } else {
                if ('show' == ctc.dis_d) {

                    // remove mobile style
                    var rm = document.querySelector('.ht_ctc_mobile_chat');
                    (rm) ? rm.remove() : '';

                    p.style.cssText = ctc.pos_d + ctc.css;
                    display(p)
                }
            }


        }

        function display(p) {
            try {
                $(p).show(parseInt(ctc.se));
            } catch (e) {
                p.style.display = "block";
            }

            greetings_display();

            ht_ctc_things(p);
        }

        // animiation, cta hover effect
        function ht_ctc_things(p) {
            console.log('animations ' + ctc.ani);
            // animations
            var an_time = ($(p).hasClass('ht_ctc_entry_animation')) ? 1200 : 120;
            setTimeout(function () {
                p.classList.add('ht_ctc_animation', ctc.ani);
            }, an_time);

            // cta hover effects
            $(".ht-ctc-chat").hover(function () {
                $('.ht-ctc-chat .ht-ctc-cta-hover').show(120);
            }, function () {
                $('.ht-ctc-chat .ht-ctc-cta-hover').hide(100);
            });
        }

        // analytics
        function ht_ctc_chat_analytics(values) {

            console.log('analytics');

            if (ctc.analytics) {
                if ('session' == ctc.analytics) {

                    if (sessionStorage.getItem('ht_ctc_analytics')) {
                        // not a unique session - return
                        console.log(sessionStorage.getItem('ht_ctc_analytics'));
                        console.log('no analytics');
                        return;
                    } else {
                        // unique session - continue..
                        console.log('no sessionStorage');
                        sessionStorage.setItem('ht_ctc_analytics', 'done');
                        console.log('added new sessionStorage');
                    }

                }

            }


            document.dispatchEvent(
                new CustomEvent("ht_ctc_event_analytics")
            );

            // global number (fixed, user created elememt)
            var id = ctc.number;

            // if its shortcode
            if (values.classList.contains('ht-ctc-sc')) {
                // shortcode number
                id = values.getAttribute('data-number');
            }

            // Google Analytics
            var ga_category = 'Click to Chat for WhatsApp';
            var ga_action = 'chat: ' + id;
            var ga_label = post_title + ', ' + url;

            // if ga_enabled
            if (ctc.ga || ctc.ga4) {
                console.log('google analytics');

                if (typeof gtag !== "undefined") {
                    console.log('gtag');
                    if (ctc.ga4) {
                        // ga4
                        // gtag may not work if ga4 installed using gtm
                        console.log('ga4');
                        gtag('event', 'click to chat', {
                            'number': id,
                            'title': post_title,
                            'url': url,
                        });
                    } else {
                        gtag('event', ga_action, {
                            'event_category': ga_category,
                            'event_label': ga_label,
                        });
                    }
                } else if (typeof ga !== "undefined" && typeof ga.getAll !== "undefined") {
                    console.log('ga');
                    var tracker = ga.getAll();
                    tracker[0].send("event", ga_category, ga_action, ga_label);
                    // ga('send', 'event', 'check ga_category', 'ga_action', 'ga_label');
                    // ga.getAll()[0].send("event", 'check ga_category', 'ga_action', 'ga_label');
                } else if (typeof __gaTracker !== "undefined") {
                    __gaTracker('send', 'event', ga_category, ga_action, ga_label);
                }
            }

            // dataLayer
            if (typeof dataLayer !== "undefined") {
                console.log('dataLayer');
                dataLayer.push({
                    'event': 'Click to Chat',
                    'type': 'chat',
                    'number': id,
                    'title': post_title,
                    'url': url,
                    'event_category': ga_category,
                    'event_label': ga_label,
                    'event_action': ga_action
                });
            }

            // google ads - call conversation code
            if (ctc.ads) {
                console.log('google ads enabled');
                if (typeof gtag_report_conversion !== "undefined") {
                    console.log('calling gtag_report_conversion');
                    gtag_report_conversion();
                }
            }

            // FB Pixel
            if (ctc.fb) {
                console.log('fb pixel');
                if (typeof fbq !== "undefined") {
                    fbq('trackCustom', 'Click to Chat by HoliThemes', {
                        'Category': 'Click to Chat for WhatsApp',
                        'return_type': 'chat',
                        'ID': id,
                        'Title': post_title,
                        'URL': url
                    });
                }
            }

        }

        // link - chat
        function ht_ctc_link(values) {

            console.log(ctc.number);
            document.dispatchEvent(
                new CustomEvent("ht_ctc_event_number", { detail: { ctc } })
            );

            console.log(ctc.number);

            var number = ctc.number;
            var pre_filled = ctc.pre_filled;

            if (values.hasAttribute('data-number')) {
                console.log('has number attribute');
                number = values.getAttribute('data-number');
            }

            if (values.hasAttribute('data-pre_filled')) {
                console.log('has pre_filled attribute');
                pre_filled = values.getAttribute('data-pre_filled');
            }

            pre_filled = pre_filled.replace(/\[url]/gi, url);

            // pre_filled = encodeURIComponent(pre_filled);
            pre_filled = encodeURIComponent(decodeURI(pre_filled));

            if ('' == number) {
                console.log('no number');
                $(".ht-ctc-chat").html(no_num);
                return;
            }

            // navigations links..
            // 1.base_url
            var base_url = 'https://wa.me/' + number + '?text=' + pre_filled;

            // 2.url_target - _blank, _self or if popup type just add a name - here popup only
            var url_target = (ctc.url_target_d) ? ctc.url_target_d : '_blank';

            if (is_mobile == 'yes') {
                console.log('-- mobile --');
                // mobile
                if (ctc.url_structure_m) {
                    console.log('-- url struture: whatsapp:// --');
                    // whatsapp://.. is selected.
                    base_url = 'whatsapp://send?phone=' + number + '&text=' + pre_filled;
                    // for whatsapp://.. url open target is _self.
                    url_target = '_self';
                }
                // custom url mobile
                if (ctc.custom_link_m && '' !== ctc.custom_link_m) {
                    console.log('custom link');
                    base_url = ctc.custom_link_m;
                }

            } else {
                // desktop
                console.log('-- desktop --');
                if (ctc.url_structure_d) {
                    console.log('-- url struture: web whatsapp --');
                    // web whatsapp is enabled/selected.
                    base_url = 'https://web.whatsapp.com/send' + '?phone=' + number + '&text=' + pre_filled;
                }

                // custom url desktop
                if (ctc.custom_link_d && '' !== ctc.custom_link_d) {
                    console.log('custom link');
                    base_url = ctc.custom_link_d;
                }
            }

            // 3.specs - specs - if popup then add 'pop_window_features' else 'noopener'
            var pop_window_features = 'scrollbars=no,resizable=no,status=no,location=no,toolbar=no,menubar=no,width=788,height=514,left=100,top=100';
            var specs = ('popup' == url_target) ? pop_window_features : 'noopener';
            console.log('-- specs: ' + specs + ' --');

            window.open(base_url, url_target, specs);

            

            // analytics
            ht_ctc_chat_analytics(values);

            // hook
            hook(number);

        }

        // shortcode
        function shortcode() {
            // shortcode - click
            $(document).on('click', '.ht-ctc-sc-chat', function () {

                var number = this.getAttribute('data-number');
                var pre_filled = this.getAttribute('data-pre_filled');
                pre_filled = pre_filled.replace(/\[url]/gi, url);
                pre_filled = encodeURIComponent(pre_filled);

                if (ctc.url_structure_d && is_mobile !== 'yes') {
                    // web.whatsapp - if web api is enabled and is not mobile
                    window.open('https://web.whatsapp.com/send' + '?phone=' + number + '&text=' + pre_filled, '_blank', 'noopener');
                } else {
                    // wa.me
                    window.open('https://wa.me/' + number + '?text=' + pre_filled, '_blank', 'noopener');
                }

                // analytics
                ht_ctc_chat_analytics(this);

                // hook
                hook(number);
            });
        }

        // custom element
        function custom_link() {

            $(document).on('click', '.ctc_chat, #ctc_chat', function (e) {
                console.log('class/Id: ctc_chat');
                ht_ctc_link(this);

                if ($(this).hasClass('ctc_woo_place')) {
                    // its woo link..
                    e.preventDefault();
                }
            });

            $(document).on('click', '[href="#ctc_chat"]', function (e) {
                console.log('#ctc_chat');
                e.preventDefault();
                ht_ctc_link(this);
            });
        }


        // webhooks
        function hook(number) {

            console.log('hook');

            if (ctc.hook_url) {

                var h_url = ctc.hook_url;

                console.log(h_url);

                var hook_values = {};

                // hook values
                if (ctc.hook_v) {

                    var hook_values = ctc.hook_v;

                    console.log(typeof hook_values);
                    console.log(hook_values);

                }

                console.log(h_url);
                console.log(hook_values);

                document.dispatchEvent(
                    new CustomEvent("ht_ctc_event_hook", { detail: { ctc, number } })
                );
                h_url = ctc.hook_url;
                console.log(h_url);

                hook_values = ctc.hook_v;
                console.log(hook_values);

                data = JSON.stringify(hook_values);

                console.log(data);
                console.log(typeof data);


                $.ajax({
                    url: h_url,
                    type: "POST",
                    mode: 'no-cors',
                    data: data,
                    success: function (response) {
                        console.log(response);
                    }
                });

                // fetch(h_url, {
                //     method: 'POST',
                //     mode: 'no-cors',
                //     headers: {
                //         'Content-Type': 'application/json'
                //     },
                //     body: JSON.stringify(data),
                // }).then(response => {
                //     console.log(response);
                // }).catch(e => {
                //     console.log(e.message);
                // });

            }


        }



    });

})(jQuery);