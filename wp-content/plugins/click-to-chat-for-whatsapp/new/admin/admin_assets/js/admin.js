// Click to Chat
document.addEventListener('DOMContentLoaded', function () {
    // md
    try {
        var elems = document.querySelectorAll('select');
        M.FormSelect.init(elems, {});
        var elems = document.querySelectorAll('.collapsible');
        M.Collapsible.init(elems, {});
        var elems = document.querySelectorAll('.modal');
        M.Modal.init(elems, {});
        var elems = document.querySelectorAll('.tooltipped');
        M.Tooltip.init(elems, {});
    } catch (e) { }
});

(function ($) {

    // ready
    $(function () {

        var admin_ctc = {};
        try {
            document.dispatchEvent(
                new CustomEvent("ht_ctc_fn_all", { detail: { admin_ctc, ctc_getItem, ctc_setItem, intl_init, intl_onchange } })
            );
        } catch (e) { }

        // local storage
        var ht_ctc_admin = {};
        var ht_ctc_admin_var = (window.ht_ctc_admin_var) ? window.ht_ctc_admin_var : {};

        if (localStorage.getItem('ht_ctc_admin')) {
            ht_ctc_admin = localStorage.getItem('ht_ctc_admin');
            ht_ctc_admin = JSON.parse(ht_ctc_admin);
        }

        // get items from ht_ctc_admin
        function ctc_getItem(item) {
            if (ht_ctc_admin[item]) {
                return ht_ctc_admin[item];
            } else {
                return false;
            }
        }

        // set items to ht_ctc_admin storage
        function ctc_setItem(name, value) {
            ht_ctc_admin[name] = value;
            var newValues = JSON.stringify(ht_ctc_admin);
            localStorage.setItem('ht_ctc_admin', newValues);
        }

        // md
        try {
            $('select').formSelect();
            $('.collapsible').collapsible();
            $('.modal').modal();
            $('.tooltipped').tooltip();
        } catch (e) { }

        // md tabs
        try {

            $(document).on('click', '.open_tab', function () {
                var tab = $(this).attr('data-tab');
                $('.tabs').tabs('select', tab);
                ctc_setItem('woo_tab', '#' + tab);
            });

            $(document).on('click', '.md_tab_li', function () {
                var href = $(this).children('a').attr('href');
                window.location.hash = href;
                ctc_setItem('woo_tab', href);
            });

            $(".tabs").tabs();

            // only on woo page.. 
            if ( document.querySelector('.ctc-admin-woo-page') && ctc_getItem('woo_tab') ) {

                var woo_tab = ctc_getItem('woo_tab');

                // setTimeout(() => {
                //     $(".tabs").tabs('select', woo_tab);
                // }, 2500);

                woo_tab = woo_tab.replace('#', '');
                setTimeout(() => {
                    $("[data-tab=" + woo_tab + "]").trigger('click');
                }, 1200);
            }

        } catch (e) { }

        try {
            intl_input('intl_number');
        } catch (e) { }


        // wpColorPicker
        var color_picker = {
            palettes: [
                '#000000',
                '#FFFFFF',
                '#075e54',
                '#128C7E',
                '#25d366',
                '#DCF8C6',
                '#34B7F1',
                '#ECE5DD',
                '#00a884',
            ],
        }
        $('.ht-ctc-color').wpColorPicker(color_picker);

        // functions
        show_hide_options();
        styles();
        call_to_action();
        ht_ctc_admin_animations();
        desktop_mobile();
        wn();
        hook();
        ss();
        url_structure();
        other();

        try {
            woo_page();
            collapsible();
        } catch (e) { }

        // jquery ui
        try {
            $(".ctc_sortable").sortable({
                cursor: "move",
                handle: '.handle'
            });
        } catch (e) { }


        // show/hide settings
        function show_hide_options() {

            // default display
            var val = $('.global_display:checked').val();

            if (val == 'show') {
                $('.global_show_or_hide_icon').addClass('dashicons dashicons-visibility');
                $(".hide_settings").show();
                $(".show_hide_types .show_btn").attr('disabled', 'disabled');
                $(".show_hide_types .show_box").hide();
            } else if (val == 'hide') {
                $('.global_show_or_hide_icon').addClass('dashicons dashicons-hidden');
                $(".show_settings").show();
                $(".show_hide_types .hide_btn").attr('disabled', 'disabled');
                $(".show_hide_types .hide_box").hide();
            }
            $('.global_show_or_hide_label').html('(' + val + ')');

            // on change
            $(".global_display").on("change", function (e) {

                var change_val = e.target.value;
                var add_class = '';
                var remove_class = '';

                $(".hide_settings").hide();
                $(".show_settings").hide();
                $(".show_hide_types .show_btn").removeAttr('disabled');
                $(".show_hide_types .hide_btn").removeAttr('disabled');
                $(".show_hide_types .show_box").hide();
                $(".show_hide_types .hide_box").hide();

                if (change_val == 'show') {
                    add_class = 'dashicons dashicons-visibility';
                    remove_class = 'dashicons-hidden';
                    $(".hide_settings").show(500);
                    $(".show_hide_types .show_btn").attr('disabled', 'disabled');
                    $(".show_hide_types .hide_box").show();
                } else if (change_val == 'hide') {
                    add_class = 'dashicons dashicons-hidden';
                    remove_class = 'dashicons-visibility';
                    $(".show_settings").show(500);
                    $(".show_hide_types .hide_btn").attr('disabled', 'disabled');
                    $(".show_hide_types .show_box").show();
                }
                $('.global_show_or_hide_label').html('(' + change_val + ')');
                $('.global_show_or_hide_icon').removeClass(remove_class);
                $('.global_show_or_hide_icon').addClass(add_class);

            });

        }


        // styles
        function styles() {

            // on change - styles
            $(".chat_select_style").on("change", function (e) {
                $(".customize_styles_link").animate({ fontSize: '1.2em' }, "slow");
            });

            // style-1 - add icon
            if ($('.s1_add_icon').is(':checked')) {
                $(".s1_icon_settings").show();
            } else {
                $(".s1_icon_settings").hide();
            }

            $(".s1_add_icon").on("change", function (e) {
                if ($('.s1_add_icon').is(':checked')) {
                    $(".s1_icon_settings").show(200);
                } else {
                    $(".s1_icon_settings").hide(200);
                }
            });

        }



        // call to actions
        function call_to_action() {
            var cta_styles = ['.ht_ctc_s2', '.ht_ctc_s3', '.ht_ctc_s3_1', '.ht_ctc_s7'];
            cta_styles.forEach(ht_ctc_admin_cta);

            function ht_ctc_admin_cta(style) {
                // default display
                var val = $(style + ' .select_cta_type').find(":selected").val();
                if (val == 'hide') {
                    $(style + " .cta_stick").hide();
                }

                // on change
                $(style + " .select_cta_type").on("change", function (e) {
                    var change_val = e.target.value;
                    if (change_val == 'hide') {
                        $(style + " .cta_stick").hide(100);
                    } else {
                        $(style + " .cta_stick").show(200);
                    }
                });
            }

        }



        function ht_ctc_admin_animations() {
            // default display
            var val = $('.select_an_type').find(":selected").val();
            if (val == 'no-animation') {
                $(".an_delay").hide();
                $(".an_itr").hide();
            }

            // on change
            $(".select_an_type").on("change", function (e) {

                var change_val = e.target.value;

                if (change_val == 'no-animation') {
                    $(".an_delay").hide();
                    $(".an_itr").hide();
                } else {
                    $(".an_delay").show(500);
                    $(".an_itr").show(500);
                }
            });
        }


        // Deskop, Mobile - same settings
        function desktop_mobile() {

            // same setting
            if ($('.same_settings').is(':checked')) {
                $(".not_samesettings").hide();
            } else {
                $(".not_samesettings").show();
            }

            $(".same_settings").on("change", function (e) {

                if ($('.same_settings').is(':checked')) {
                    $(".not_samesettings").hide(900);
                    $(".select_styles_issue_checkbox").hide();
                } else {
                    $(".not_samesettings").show(900);
                }

            });

        }


        // WhatsApp number  
        function wn() {

            var cc = $("#whatsapp_cc").val();
            var num = $("#whatsapp_number").val();

            $("#whatsapp_cc").on("change paste keyup", function (e) {
                cc = $("#whatsapp_cc").val();
                call();
            });

            $("#whatsapp_number").on("change paste keyup", function (e) {
                num = $("#whatsapp_number").val();
                call();

                if (num && 0 == num.charAt(0)) {
                    $('.ctc_wn_initial_zero').show(500);
                } else {
                    $('.ctc_wn_initial_zero').hide(500);
                }
            });

            function call() {
                $(".ht_ctc_wn").html(cc + '' + num);
                $("#ctc_whatsapp_number").val(cc + '' + num);
            }

        }

        // url structure - custom url..
        function url_structure() {
            // default display
            var url_structure_d = $('.url_structure_d').find(":selected").val();
            if (url_structure_d == 'custom_url') {
                $(".custom_url_desktop").show();
            }

            var url_structure_m = $('.url_structure_m').find(":selected").val();
            if (url_structure_m == 'custom_url') {
                $(".custom_url_mobile").show();
            }

            // on change
            $(".url_structure_d").on("change", function (e) {

                var change_url_structure_d = e.target.value;

                if (change_url_structure_d == 'custom_url') {
                    $(".custom_url_desktop").show(500);
                } else {
                    $(".custom_url_desktop").hide(500);
                }
            });
            $(".url_structure_m").on("change", function (e) {

                var change_url_structure_m = e.target.value;

                if (change_url_structure_m == 'custom_url') {
                    $(".custom_url_mobile").show(500);
                } else {
                    $(".custom_url_mobile").hide(500);
                }
            });


        }

        // woo page..
        function woo_page() {

            //  Woo single product page - woo position
            var position_val = $('.woo_single_position_select').find(":selected").val();
            // woo add to cart layout
            var style_val = $('.woo_single_style_select').find(":selected").val();

            if (position_val && '' !== position_val && 'select' !== position_val) {
                $('.woo_single_position_settings').show();
            }
            if (position_val && 'select' == position_val) {
                hide_cart_layout();
            } else if (style_val && style_val == '1' || style_val == '8') {
                // if position_val is not 'select'
                show_cart_layout();
            }

            // on change - select position
            $('.woo_single_position_select').on("change", function (e) {
                var position_change_val = e.target.value;
                var style_val = $('.woo_single_style_select').find(":selected").val();

                if (position_change_val == 'select') {
                    $('.woo_single_position_settings').hide(200);
                    hide_cart_layout();
                } else {
                    $('.woo_single_position_settings').show(200);
                    if (style_val == '1' || style_val == '8') {
                        show_cart_layout();
                    }
                }
            });

            // on change - style - for cart layout
            $('.woo_single_style_select').on("change", function (e) {
                var style_change_val = e.target.value;

                if (style_change_val == '1' || style_change_val == '8') {
                    show_cart_layout();
                } else {
                    hide_cart_layout();
                }
            });

            // position center is checked
            if ($('#woo_single_position_center').is(':checked')) {
                $(".woo_single_position_center_checked_content").show();
            }

            $("#woo_single_position_center").on("change", function (e) {
                if ($('#woo_single_position_center').is(':checked')) {
                    $(".woo_single_position_center_checked_content").show(200);
                } else {
                    $(".woo_single_position_center_checked_content").hide(100);
                }
            });



            // woo shop page .. 
            if ($('#woo_shop_add_whatsapp').is(':checked')) {
                $(".woo_shop_add_whatsapp_settings").show();

                var shop_style_val = $('.woo_shop_style').find(":selected").val();
                if (shop_style_val == '1' || shop_style_val == '8') {
                    shop_show_cart_layout();
                }
            }




            $("#woo_shop_add_whatsapp").on("change", function (e) {
                if ($('#woo_shop_add_whatsapp').is(':checked')) {
                    $(".woo_shop_add_whatsapp_settings").show(200);

                    var shop_style_val = $('.woo_shop_style').find(":selected").val();

                    if (shop_style_val == '1' || shop_style_val == '8') {
                        shop_show_cart_layout();
                    }

                } else {
                    $(".woo_shop_add_whatsapp_settings").hide(100);
                    shop_hide_cart_layout(100);
                }
            });


            // on change - style - for cart layout
            $('.woo_shop_style').on("change", function (e) {
                var shop_style_change_val = e.target.value;

                if (shop_style_change_val == '1' || shop_style_change_val == '8') {
                    shop_show_cart_layout();
                } else {
                    shop_hide_cart_layout();
                }
            });


            function show_cart_layout() {
                $(".woo_single_position_settings_cart_layout").show(200);
            }
            function hide_cart_layout() {
                $(".woo_single_position_settings_cart_layout").hide(200);
            }

            function shop_show_cart_layout() {
                $(".woo_shop_cart_layout").show(200);
            }
            function shop_hide_cart_layout() {
                $(".woo_shop_cart_layout").hide(200);
            }

        }


        // webhook
        function hook() {

            // webhook value - html 
            var hook_value_html = $('.add_hook_value').attr('data-html');

            // add value
            $(document).on('click', '.add_hook_value', function () {

                $('.ctc_hook_value').append(hook_value_html);
            });

            // Remove value
            $('.ctc_hook_value').on('click', '.hook_remove_value', function (e) {
                e.preventDefault();
                $(this).closest('.additional-value').remove();
            });

        }


        // things based on screen size
        function ss() {

            var is_mobile = (typeof screen.width !== "undefined" && screen.width > 1024) ? "no" : "yes";

            if ('yes' == is_mobile) {

                // WhatsApp number tooltip position for mobile
                // $("#whatsapp_cc").data('position', 'bottom');
                $("#whatsapp_cc").attr('data-position', 'bottom');
                $("#whatsapp_number").attr('data-position', 'bottom');
            }
        }


        function other() {

            // google ads - checkbox
            $('.ga_ads_display').on('click', function (e) {
                $('.ga_ads_checkbox').toggle(500);
            });

            // display - call gtag_report_conversion by default if checked.
            if ($('#ga_ads').is(':checked')) {
                $(".ga_ads_checkbox").show();
            }

            // hover text on save_changes button
            var text = $('#ctc_save_changes_hover_text').text();
            $("#submit").attr('title', text);

            // analytics - ga4 display only if ga is enabled.
            $("#google_analytics").on("change", function (e) {
                if ($('#google_analytics').is(':checked')) {
                    $(".ctc_ga4").show();
                } else {
                    $(".ctc_ga4").hide();
                }
            });

            if ($('#google_analytics').is(':checked')) {
                $(".ctc_ga4").show();
            } else {
                $(".ctc_ga4").hide();
            }

            // select styles issue

            if ($('#select_styles_issue').is(':checked')) {
                $(".select_styles_issue_checkbox").show();
            }
            $('.select_styles_issue_description').on('click', function (e) {
                $('.select_styles_issue_checkbox').toggle(500);
            });


            // s3e - shadow on hover
            if (!$('#s3_box_shadow').is(':checked')) {
                $(".s3_box_shadow_hover").show();
            }

            $('#s3_box_shadow').on('change', function (e) {
                if ($('#s3_box_shadow').is(':checked')) {
                    $(".s3_box_shadow_hover").hide(400);
                } else {
                    $(".s3_box_shadow_hover").show(500);
                }
            });

            // analytics count
            $(".analytics_count_message").on("click", function (e) {
                $(".analytics_count_message span").hide();
                $('.analytics_count_select').show(200);
            });

        }

        // collapsible..
        function collapsible() {

            

            /**
             * ht_ctc_sidebar_contat - not added, as it may cause view distraction..
             */
            var styles_list = [
                'ht_ctc_s1',
                'ht_ctc_s2',
                'ht_ctc_s3',
                'ht_ctc_s3_1',
                'ht_ctc_s4',
                'ht_ctc_s5',
                'ht_ctc_s6',
                'ht_ctc_s7',
                'ht_ctc_s7_1',
                'ht_ctc_s8',
                'ht_ctc_s99',
                'ht_ctc_webhooks',
                'ht_ctc_analytics',
                'ht_ctc_animations',
                'ht_ctc_other_settings',
                'ht_ctc_enable_share_group',
                'ht_ctc_debug',
                'ht_ctc_device_settings',
                'ht_ctc_show_hide_settings',
                'ht_ctc_woo_1',
                'ht_ctc_woo_shop',
                'ctc_g_opt_in',
                'g_content_collapsible',
                'url_structure',
            ];

            if (document.querySelector('.coll_active')) {
                $('.coll_active').each(function () {
                    styles_list.push($(this).attr('data-coll_active'));
                });
            }
            

            var default_active = [
                'ht_ctc_device_settings',
                'ht_ctc_show_hide_settings',
                'ht_ctc_woo_1',
                'ht_ctc_webhooks',
                'ht_ctc_analytics',
                'ht_ctc_animations',
                'ht_ctc_other_settings',
                'g_content_collapsible',
                'url_structure',
            ];


            styles_list.forEach(e => {

                // one known issue.. is already active its not working as expected. 
                var is_col = (ctc_getItem('col_' + e)) ? ctc_getItem('col_' + e) : '';
                if ('open' == is_col) {
                    $('.' + e + ' li').addClass('active');
                } else if ('close' == is_col) {
                    $('.' + e + ' li').removeClass('active');
                } else if (default_active.includes(e)) {
                    // if not changed then for default_active list add active..
                    $('.' + e + ' li').addClass('active');
                }


                $('.' + e).collapsible({
                    onOpenEnd() {
                        ctc_setItem('col_' + e, 'open');
                    },
                    onCloseEnd() {
                        ctc_setItem('col_' + e, 'close');
                    }
                });

            });

        }

        // intl
        function intl_init(v) {

            var hidden_input = $(v).attr("data-name") ? $(v).attr("data-name") : '';
            $(v).removeAttr('name');
            var pre_countries = [];
            var country_code_date = new Date().toDateString();
            var country_code = (ctc_getItem('country_code_date') == country_code_date) ? ctc_getItem('country_code') : '';

            if ('' == country_code) {
                $.get("https://ipinfo.io", function () { }, "jsonp").always(function (resp) {
                    country_code = (resp && resp.country) ? resp.country : "us";
                    ctc_setItem('country_code', country_code);
                    ctc_setItem('country_code_date', country_code_date);
                    call_intl();
                });
            } else {
                call_intl();
            }

            var intl = '';
            function call_intl() {
                add_prefer_countrys(country_code);
                pre_countries = (ctc_getItem('pre_countries')) ? ctc_getItem('pre_countries') : [];
                
                intl = intlTelInput(v, {
                    autoHideDialCode: false,
                    initialCountry: "auto",
                    geoIpLookup: function (success, failure) {
                        success(country_code);
                    },
                    dropdownContainer: document.body,
                    // formatOnDisplay: true,
                    hiddenInput: hidden_input,
                    nationalMode: false,
                    autoPlaceholder: "polite",
                    preferredCountries: pre_countries,
                    separateDialCode: true,
                    utilsScript: ht_ctc_admin_var.utils
                });
            }

            return intl;
        }

        /**
         * intl tel input 
         * intlTelInput - from intl js.. 
         */
        function intl_input(className) {
            if (document.querySelector("." + className) && typeof intlTelInput !== 'undefined') {

                $('.' + className).each(function () {
                    var i = intl_init(this);
                });

                intl_onchange();
            }
        }

        function intl_onchange() {
            $('.intl_number').on("input countrychange", function (e) {
                var changed = intlTelInputGlobals.getInstance(this);
                // changed.getNumber()
                if (changed.isValidNumber()) {
                    // to display in format
                    changed.setNumber(changed.getNumber());
                }
            });

            $('.intl_number').on("countrychange", function (e) {
                var changed = intlTelInputGlobals.getInstance(this);
                add_prefer_countrys(changed.getSelectedCountryData().iso2);
            });
        }

        function add_prefer_countrys(country_code) {
            country_code = country_code.toUpperCase();
            var pre_countries = (ctc_getItem('pre_countries')) ? ctc_getItem('pre_countries') : [];
            if (!pre_countries.includes(country_code)) {
                pre_countries.push(country_code);
                ctc_setItem('pre_countries', pre_countries);
            }
        }


    });
})(jQuery);