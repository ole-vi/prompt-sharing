---
title: "A Very Simple Website: Back to the Basics | by David W. Gray | Medium"
source: https://medium.com/@dwgray/a-very-simple-website-back-to-the-basics-1dffdc43d19b
domain: medium.com
captured: 2025-12-17T18:26:36.100Z
type: web-clip
---

# A Very Simple Website: Back to the Basics | by David W. Gray | Medium

**Source:** [https://medium.com/@dwgray/a-very-simple-website-back-to-the-basics-1dffdc43d19b](https://medium.com/@dwgray/a-very-simple-website-back-to-the-basics-1dffdc43d19b)

**Captured:** 12/17/2025, 1:26:36 PM

---

# A Very Simple Website: Back to the Basics

[](/@dwgray?source=post_page---byline--1dffdc43d19b---------------------------------------)[David W. Gray](/@dwgray?source=post_page---byline--1dffdc43d19b---------------------------------------)Follow7 min read·Sep 16, 2024[](/m/signin?actionUrl=https%3A%2F%2Fmedium.com%2F_%2Fvote%2Fp%2F1dffdc43d19b&operation=register&redirect=https%3A%2F%2Fmedium.com%2F%40dwgray%2Fa-very-simple-website-back-to-the-basics-1dffdc43d19b&user=David+W.+Gray&userId=eb2420cf35d4&source=---header_actions--1dffdc43d19b---------------------clap_footer------------------)2

[](/m/signin?actionUrl=https%3A%2F%2Fmedium.com%2F_%2Fbookmark%2Fp%2F1dffdc43d19b&operation=register&redirect=https%3A%2F%2Fmedium.com%2F%40dwgray%2Fa-very-simple-website-back-to-the-basics-1dffdc43d19b&source=---header_actions--1dffdc43d19b---------------------bookmark_footer------------------)[Listen](/m/signin?actionUrl=https%3A%2F%2Fmedium.com%2Fplans%3Fdimension%3Dpost_audio_button%26postId%3D1dffdc43d19b&operation=register&redirect=https%3A%2F%2Fmedium.com%2F%40dwgray%2Fa-very-simple-website-back-to-the-basics-1dffdc43d19b&source=---header_actions--1dffdc43d19b---------------------post_audio_button------------------)Share

One of the students I’m mentoring is taking his first web development class. They ask the students to build a small website from scratch using just HTML, CSS, and JavaScript. I think this is a good thing because it’s worth knowing how the core elements of a website work before diving into a more real-world scenario using a bunch of libraries and build tools to create a site.

The thing that got lost in translation was some of the basics of how such a site works. This confusion is something that I’ve seen happen with less experienced engineers who are either right out of college or have been working on desktop applications or embedded systems and are moving into a team that’s doing full-stack development. The last time that happened on a team I was leading, I sat the whole team in a room. The folks who had experience with web development fielded questions and drew diagrams on whiteboards until those who didn’t have experience in web development felt like they were at least starting to get a clue. It was a blast, and while I’m unable to reproduce that in a blog post, I’d like to cover just a few of the concepts in web development that often get lost in the complexity of modern tooling.

## What is a Web Site?

All you *really*need to build a website is a text editor, somewhere to store the files you create, and a program to serve those files to a browser. There doesn’t *have*to be a build process, complicated systems to manage the site’s components, or dependencies on a bunch of different libraries.

Now, you’ll want all those things and possibly more for a production website in the real world. But if you’re learning how things work, getting back to basics has some real value.

So, what are some examples of those three components?

I won’t spend much time on the text editor. [Visual Studio Code](https://code.visualstudio.com/) tends to be the industry default these days, but Notepad, Edit, or any basic text editor will work.

The software used to serve up the website is generically called a [web server](https://en.wikipedia.org/wiki/Web_server). When I first built websites in the mid-nineties, I ran [Internet Information Server](https://www.iis.net/) on a PC sitting in my spare bedroom, and the file store was just the Windows file system. The key to making this a public-facing website was that the computer was connected to the internet via my [ISP](https://en.wikipedia.org/wiki/Internet_service_provider), and IIS was capable of communicating with the rest of the internet via HTTP, HTTPS, and other protocols.[¹](#6c6a)

## Creating a Website Locally

Before getting into how to create a public website, I’d like to write and test a website on my local computer with as little extra tooling as possible. It turns out I can just let the file system serve up the files to the browser, acting as both the file store and the server. In this case, it’s serving up via the local file protocol rather than the HTTP(S) protocol that a web server would produce, but modern browsers recognize both. For [Chromium-based](https://www.chromium.org/chromium-projects/) browsers, you’ll get an info icon next to the path name, and the URL may be reformatted to show as a URL rather than a path “file:///C:/…” vs. “C:\…”. But this will work just fine for a local website.

For instance, I can create an extremely simple page by saving the following to a file called “simple.html”

```
<!doctype html><body>Testing a simple page</body>
```

Press enter or click to view image in full size![image](https://miro.medium.com/v2/resize:fit:1050/1*sKTwkSojemB-fki9xksFeQ.png)

A screenshot of my very simple pageOr see it live at [dwgray.github.io/simple.html](https://dwgray.github.io/simple.html)

Now, I’m terrible with graphics design in the niceties of CSS, so I will fudge my rules and start with[Bootstrap’s](https://getbootstrap.com/)[minimal template](https://github.com/twbs/examples/tree/main/starter/). That will give me some HTML scaffolding and pull Bootstrap from a [CDN](https://en.wikipedia.org/wiki/Content_delivery_network) to get me started with something that isn’t the total ugliness I’d create on my own. Using libraries like this is explicitly disallowed by the student project that got me started down this path, but since I’m not getting graded on my work, I’ll let myself “cheat” in this one aspect.

Now I have a site that looks like the image below and has`index.html,` `main.js`, and `style.css` files. The index file references the `.css` and `.js` files using relative URLs.

Press enter or click to view image in full size![image](https://miro.medium.com/v2/resize:fit:1050/1*QbxCEsutFXQg7QCy2bFHfA.png)

A very simple site using the bootstrap CDN templateUsing [relative URLs](https://www.tutorialspoint.com/difference-between-an-absolute-url-and-a-relative-url) is essential since it will let me use code without modification as a public website and a locally running file system “site.”

```
<link rel="stylesheet" href="styles.css"><script src="main.js"></script>
```

You can peruse this code on [github](http://dwgray/dwgray.github.io at 2feaa0a6675c7e05d42b48d7ad3450c6cf39a70b)— ignore the other files for now; we’ll get to them later.

## Get David W. Gray’s stories in your inbox

Join Medium for free to get updates from this writer.

SubscribeSubscribeThe other important thing about this setup is that I have full access to the developer tools in my browser, so I can inspect my website and use many of the same tools I’d use in real-world development to debug it. If you’re doing anything with web development and don’t know the browser developer tools, stop now and get to know them. ([Edge](https://learn.microsoft.com/en-us/microsoft-edge/devtools-guide-chromium/overview), [Chrome](https://developer.chrome.com/docs/devtools/), [Firefox](https://www.mozilla.org/en-US/firefox/developer/), [Safari](https://developer.apple.com/safari/tools/)).

If you’ve worked with more complex development tools like [Vite](https://vitejs.dev/) or [WebPack](https://webpack.js.org/), they use various mechanisms that cause the site to update in your browser as soon as you save the file. These go by names like “Hot Reload” or “Live Update”. If you’re working with Visual Studio Code, one way to achieve a version of live updating is by installing [LiveServer](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) and running it against your workspace. LiveServer now acts as the web server and performs the magic to update your site anytime you save it. Now, you’re running the site as a local website communicating over HTTP rather than as a file system site.

But the plain file system site works just fine overall; you just have to remember to hit the refresh button on your browser to see the changes you’ve made.

## Publishing my Site

The student I’m working with was pointed to [GitHub Pages](https://pages.github.com/) or [w3spaces](https://spaces.w3schools.com/createspace) to publish his site.

For W3spaces, I could get this very minimal site working by creating their blank template and copying over my source to the three files they create with that template. However, I couldn’t get any further than that without paying, so I’ll just point you to [the site](https://dwgray.w3spaces.com/) and call that good.

I’m more interested in GitHub Pages since that’s something that the projects I’m working on use but that I haven’t dug into yet. By default, they use a build system called [Jekyll](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/about-github-pages-and-jekyll) to build and deploy pages. And there is some cool stuff built in, where they will build your checked-in markdown files into HTML pages. You can also use [GitHub Actions](https://docs.github.com/en/actions) to do more complex building and deploying of a site, which is what the projects I’m working on are doing.

But that’s not what I was looking for in this case. I wanted the most straightforward system I could manage and still have a viable website.

It turns out that I can disable Jekyll by adding a `.nojekyll` file to the root of my project, and then the deploy step is to directly copy the `main` branch of my GitHub repo to whatever they’re using to serve up the pages. I didn’t figure out what they’re using as a web server or file store, but if I were implementing a system like this, I’d consider something like [Azure Front Door](https://azure.microsoft.com/en-us/products/frontdoor/) to serve the pages from [Azure Storage](https://learn.microsoft.com/en-us/azure/frontdoor/integrate-storage-account) or [Amazon CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/IntroductionUseCases.html#IntroductionUseCasesStaticWebsite) to serve pages from [S3](https://aws.amazon.com/pm/serv-s3). In any case, this is about as simple as I could manage.

So I created a GitHub Pages site with Jekyll turned off and started playing around. I created a repo with the required name ([dwgray.github.io](https://dwgray.github.io/)) for a personal site and cloned it to my local machine. I added the files I grabbed from the Bootstrap template on my local repo and tested them to ensure the site was still behaving as expected. Then I pushed my change to my main branch, which deployed to [dwgray.github.io](https://dwgray.github.io/)[²](#cbd1). There is a slight latency between the push and when the deployment completes, but after waiting less than a minute, my site was live.

Press enter or click to view image in full size![image](https://miro.medium.com/v2/resize:fit:1050/1*yL1Kh3DO7CoNzP2RZHF31Q.png)

My slightly less simple multi-page site## Conclusion

I created a simple site using just a vanilla text editor, ran it as a file system site on my local machine, and published it to a GitHub Pages site. I did all of this without using complex build systems or libraries to show some of the fundamentals of how a website works. If you’re new to web development, hopefully this helped you fill in some holes in your mental model of the systems you’re working with.

The sample website is available at [dwgray.github.io](http://dwgray.github.io), and the source code can be found at [dwgray / dwgray.github.io / multi-page](https://github.com/dwgray/dwgray.github.io/tree/multi-page).[³](http://3cdb)

¹ In order for the web browser to find the website, you’ll need to configure [DNS](https://www.cloudflare.com/learning/dns/what-is-dns/) and have a static IP or some other method of pointing the DNS record to a server that the browser can communicate with, but that’s beyond the scope of this article.

² Notice that you don’t have to include the name of the main `index.html` page when navigating to the website in the browser. This is because the web server has the concept of a default page (or pages) that it will attempt to load if you just specify the base URL.

³ If you peruse the code of my multi-page site you’ll notice that there is a bunch of code that is copied and pasted between each of the pages. The biggest chunk is the navigation bar code, but even the scaffolding code of the <head> is duplicated. I’ve mentioned before that I’m allergic to duplicate code, and that is still true. That’s one of the reasons to use more sophisticated tools to build a website, as they all provide one means or another to avoid this kind of duplication.

