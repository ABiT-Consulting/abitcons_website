(function ($) {

    // ready
    $(function () {

        if (document.querySelector('.pr_greetings_template')) {
            try {
                greetings_template();
            } catch (e) {}
        }

        if (document.querySelector('.ctc-admin-greetings-page') || document.querySelector('.ctc-admin-woo-page')) {
            try {
                editor();
            } catch (e) {}
        }

        /**
        * display settings based on Greetings template selection
        */
        function greetings_template() {

            var greetings_template = $('.pr_greetings_template select').find(":selected").val();

            if (greetings_template == 'no' || '' == greetings_template) {
                $('.g_content_collapsible').hide();
            } else {
                $('.g_content_collapsible').show();
            }
            
            // greetings-1
            if (greetings_template == 'greetings-1') {
                $('.ctc_greetings_settings.ctc_g_1').show();
                $('.pr_ht_ctc_greetings_1').show();
                $('.pr_ht_ctc_greetings_settings').show();
                $('.ctc_greetings_notes').show();
                optin();
            }

            // greetings-2
            if (greetings_template == 'greetings-2') {
                $('.ctc_greetings_settings.ctc_g_2').show();
                $('.pr_ht_ctc_greetings_2').show();
                $('.pr_ht_ctc_greetings_settings').show();
                $('.ctc_greetings_notes').show();
                optin();
            }

            // on change
            $('.pr_greetings_template select').on("change", function (e) {
                var greetings_template = e.target.value;

                // ctc_greetings_settings 
                if (greetings_template == 'no') {
                    $('.g_content_collapsible').hide(100);
                    $(" .ctc_greetings_settings").hide();
                } else {
                    // $(" ." + greetings_template).show(100);
                    
                    $('.g_content_collapsible').show();

                    // if not no - then first hide all and again display required fields..
                    if (greetings_template == 'greetings-2' || greetings_template == 'greetings-1') {
                        $(" .ctc_greetings_settings").hide();
                    }
                    $('.ctc_greetings_notes').show();

                    // greetings-1
                    if (greetings_template == 'greetings-1') {
                        $('.ctc_greetings_settings.ctc_g_1').show(100);
                        $('.pr_ht_ctc_greetings_1').show(100);
                        optin();
                    }
                    // greetings-2
                    if (greetings_template == 'greetings-2') {
                        $('.ctc_greetings_settings.ctc_g_2').show(100);
                        $('.pr_ht_ctc_greetings_2').show(100);
                        optin();
                    }

                    $('.pr_ht_ctc_greetings_settings').show();

                }
            });


            // optin - show/hide
            function optin() {
                if ($('.is_opt_in').is(':checked')) {
                    $(".pr_opt_in ").show(200);
                } else {
                    $(".pr_opt_in ").hide(200);
                }
            }
            // optin change
            $(".is_opt_in").on("change", function (e) {
                optin();
            });

        }




        /**
         * tinymce editor
         * only on greetings, woo pages
         *  bg color
         */
        function editor() {
            var check = 1;
            var check_interval = 1000;
            var check_times = 28; // ( check_times * check_interval = total milliseconds )

            function tiny_bg() {
                if (document.getElementById("header_content_ifr")) {
                    try {
                        tiny_bg_color();
                    } catch (e) { }
                } else {
                    check++;
                    if (check < check_times) {
                        setTimeout(tiny_bg, check_interval);
                    }
                }
            }
            // also calls from setTimeout....
            tiny_bg();

            function tiny_bg_color() {
                var i = document.querySelectorAll(".ctc_wp_editor iframe");
                i.forEach(e => {
                    var elmnt = e.contentWindow.document.getElementsByTagName("body")[0];
                    elmnt.style.backgroundColor = "#26a69a";
                });
            }
        }


    });


})(jQuery);